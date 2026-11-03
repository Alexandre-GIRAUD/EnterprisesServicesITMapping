package com.enterprise.itmapping.feature.sources.application;

import com.enterprise.itmapping.feature.sources.domain.SourceAuthType;
import com.enterprise.itmapping.feature.sources.domain.SourceKind;
import com.enterprise.itmapping.feature.sources.infrastructure.persistence.DataSourceEntity;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

/** Reads the rows of a data source: a GET on a JSON API, or one tool call on an MCP server. */
@Component
public class SourceRowsFetcher {

  private static final Duration TIMEOUT = Duration.ofSeconds(20);
  private static final String MCP_PROTOCOL = "2025-03-26";

  private final ObjectMapper mapper;
  private final HttpClient http =
      HttpClient.newBuilder().connectTimeout(TIMEOUT).followRedirects(HttpClient.Redirect.NEVER).build();

  public SourceRowsFetcher(ObjectMapper mapper) {
    this.mapper = mapper;
  }

  public List<Map<String, Object>> fetch(DataSourceEntity source, String secret) {
    try {
      JsonNode root =
          source.getKind() == SourceKind.MCP ? callMcpTool(source, secret) : getJson(source, secret);
      return rows(navigate(root, source.getItemsPath()));
    } catch (IOException e) {
      throw badGateway("Source unreachable: " + e.getMessage());
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw badGateway("Source call interrupted.");
    }
  }

  private JsonNode getJson(DataSourceEntity source, String secret)
      throws IOException, InterruptedException {
    HttpRequest.Builder request = request(source).GET().header("Accept", "application/json");
    authHeaders(source, secret).forEach(request::header);
    return mapper.readTree(send(request.build()).body());
  }

  private JsonNode callMcpTool(DataSourceEntity source, String secret)
      throws IOException, InterruptedException {
    if (!StringUtils.hasText(source.getToolName())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "An MCP source needs a tool name.");
    }
    Map<String, String> auth = authHeaders(source, secret);
    HttpResponse<String> init =
        send(mcpPost(source, auth, null, rpc(1, "initialize", initParams())));
    String session = init.headers().firstValue("Mcp-Session-Id").orElse(null);
    send(mcpPost(source, auth, session, rpc(null, "notifications/initialized", Map.of())));
    JsonNode reply =
        rpcResult(
            send(
                mcpPost(
                    source,
                    auth,
                    session,
                    rpc(
                        2,
                        "tools/call",
                        Map.of("name", source.getToolName(), "arguments", Map.of())))));
    JsonNode structured = reply.get("structuredContent");
    if (structured != null) {
      return structured;
    }
    JsonNode text = reply.path("content").path(0).path("text");
    if (text.isMissingNode()) {
      throw badGateway("The MCP tool returned no content.");
    }
    return mapper.readTree(text.asText());
  }

  private Map<String, Object> initParams() {
    return Map.of(
        "protocolVersion", MCP_PROTOCOL,
        "capabilities", Map.of(),
        "clientInfo", Map.of("name", "flowra", "version", "1"));
  }

  private Map<String, Object> rpc(Integer id, String method, Object params) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("jsonrpc", "2.0");
    if (id != null) {
      body.put("id", id);
    }
    body.put("method", method);
    body.put("params", params);
    return body;
  }

  private HttpRequest mcpPost(
      DataSourceEntity source, Map<String, String> auth, String session, Map<String, Object> body)
      throws IOException {
    HttpRequest.Builder request =
        request(source)
            .header("Content-Type", "application/json")
            .header("Accept", "application/json, text/event-stream")
            .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)));
    auth.forEach(request::header);
    if (session != null) {
      request.header("Mcp-Session-Id", session);
    }
    return request.build();
  }

  /** The reply is plain JSON or a server-sent event stream carrying one JSON-RPC message. */
  private JsonNode rpcResult(HttpResponse<String> response) throws IOException {
    String body = response.body();
    String payload = body;
    if (body.stripLeading().startsWith("event:") || body.stripLeading().startsWith("data:")) {
      payload =
          body.lines()
              .filter(line -> line.startsWith("data:"))
              .reduce((first, second) -> second)
              .map(line -> line.substring(5).trim())
              .orElse("{}");
    }
    JsonNode message = mapper.readTree(payload);
    if (message.has("error")) {
      throw badGateway("MCP error: " + message.path("error").path("message").asText("unknown"));
    }
    return message.path("result");
  }

  private HttpRequest.Builder request(DataSourceEntity source) {
    URI uri = URI.create(source.getEndpoint().trim());
    if (!"http".equals(uri.getScheme()) && !"https".equals(uri.getScheme())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The endpoint must be http(s).");
    }
    return HttpRequest.newBuilder(uri).timeout(TIMEOUT);
  }

  private HttpResponse<String> send(HttpRequest request) throws IOException, InterruptedException {
    HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() >= 300) {
      throw badGateway("Source answered HTTP " + response.statusCode() + ".");
    }
    return response;
  }

  private static Map<String, String> authHeaders(DataSourceEntity source, String secret) {
    SourceAuthType type = source.getAuthType() != null ? source.getAuthType() : SourceAuthType.NONE;
    if (type == SourceAuthType.NONE || !StringUtils.hasText(secret)) {
      return Map.of();
    }
    return switch (type) {
      case BEARER -> Map.of("Authorization", "Bearer " + secret);
      case API_KEY ->
          Map.of(
              StringUtils.hasText(source.getAuthHeaderName()) ? source.getAuthHeaderName() : "X-API-Key",
              secret);
      case BASIC ->
          Map.of(
              "Authorization",
              "Basic "
                  + Base64.getEncoder()
                      .encodeToString(
                          ((source.getAuthUsername() != null ? source.getAuthUsername() : "")
                                  + ":"
                                  + secret)
                              .getBytes(StandardCharsets.UTF_8)));
      case NONE -> Map.of();
    };
  }

  private static JsonNode navigate(JsonNode root, String path) {
    JsonNode node = root;
    if (StringUtils.hasText(path)) {
      for (String part : path.trim().split("\\.")) {
        node = node.path(part);
      }
    }
    return node;
  }

  private List<Map<String, Object>> rows(JsonNode array) {
    if (!array.isArray()) {
      throw badGateway("The source did not return a list of rows.");
    }
    List<Map<String, Object>> rows = new ArrayList<>();
    for (JsonNode item : array) {
      if (item.isObject()) {
        rows.add(mapper.convertValue(item, new TypeReference<LinkedHashMap<String, Object>>() {}));
      }
    }
    return rows;
  }

  private static ResponseStatusException badGateway(String message) {
    return new ResponseStatusException(HttpStatus.BAD_GATEWAY, message);
  }
}
