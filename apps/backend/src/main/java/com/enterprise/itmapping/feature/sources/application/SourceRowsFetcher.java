package com.enterprise.itmapping.feature.sources.application;

import com.enterprise.itmapping.feature.sources.domain.SourceAuthType;
import com.enterprise.itmapping.feature.sources.domain.SourceKind;
import com.enterprise.itmapping.feature.sources.infrastructure.persistence.DataSourceEntity;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.InetAddress;
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
  private static final int HTTP_REDIRECT_STATUS = 300;
  private static final String MCP_PROTOCOL = "2025-03-26";
  private static final String MCP_SESSION_HEADER = "Mcp-Session-Id";
  private static final String DEFAULT_API_KEY_HEADER = "X-API-Key";
  private static final String JSON = "application/json";
  private static final String JSON_OR_EVENTS = "application/json, text/event-stream";
  private static final String DATA_PREFIX = "data:";
  private static final String EVENT_PREFIX = "event:";
  private static final int INITIALIZE_ID = 1;
  private static final int CALL_ID = 2;

  private final ObjectMapper mapper;
  private final HttpClient http =
      HttpClient.newBuilder()
          .connectTimeout(TIMEOUT)
          .followRedirects(HttpClient.Redirect.NEVER)
          .build();

  public SourceRowsFetcher(ObjectMapper mapper) {
    this.mapper = mapper;
  }

  public List<Map<String, Object>> fetch(DataSourceEntity source, String secret) {
    try {
      JsonNode root =
          source.getKind() == SourceKind.MCP ? callMcpTool(source, secret) : getJson(source, secret);
      return toRows(navigate(root, source.getItemsPath()));
    } catch (IOException e) {
      throw badGateway("Source unreachable: " + e.getMessage());
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw badGateway("The call to the source was interrupted.");
    }
  }

  private JsonNode getJson(DataSourceEntity source, String secret)
      throws IOException, InterruptedException {
    HttpRequest.Builder request = newRequest(source).GET().header("Accept", JSON);
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
        send(mcpPost(source, auth, null, rpc(INITIALIZE_ID, "initialize", initializeParams())));
    String session = init.headers().firstValue(MCP_SESSION_HEADER).orElse(null);
    send(mcpPost(source, auth, session, rpc(null, "notifications/initialized", Map.of())));
    Map<String, Object> call =
        rpc(CALL_ID, "tools/call", Map.of("name", source.getToolName(), "arguments", Map.of()));
    JsonNode result = rpcResult(send(mcpPost(source, auth, session, call)));
    return toolOutput(result);
  }

  private JsonNode toolOutput(JsonNode result) throws IOException {
    JsonNode structured = result.get("structuredContent");
    if (structured != null) {
      return structured;
    }
    JsonNode text = result.path("content").path(0).path("text");
    if (text.isMissingNode()) {
      throw badGateway("The MCP tool returned no content.");
    }
    return mapper.readTree(text.asText());
  }

  private Map<String, Object> initializeParams() {
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
        newRequest(source)
            .header("Content-Type", JSON)
            .header("Accept", JSON_OR_EVENTS)
            .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)));
    auth.forEach(request::header);
    if (session != null) {
      request.header(MCP_SESSION_HEADER, session);
    }
    return request.build();
  }

  /** The reply is plain JSON or a server-sent event stream carrying one JSON-RPC message. */
  private JsonNode rpcResult(HttpResponse<String> response) throws IOException {
    JsonNode message = mapper.readTree(jsonPayload(response.body()));
    if (message.has("error")) {
      throw badGateway("MCP error: " + message.path("error").path("message").asText("unknown"));
    }
    return message.path("result");
  }

  private static String jsonPayload(String body) {
    String trimmed = body.stripLeading();
    boolean isEventStream = trimmed.startsWith(EVENT_PREFIX) || trimmed.startsWith(DATA_PREFIX);
    if (!isEventStream) {
      return body;
    }
    return trimmed
        .lines()
        .filter(line -> line.startsWith(DATA_PREFIX))
        .reduce((first, second) -> second)
        .map(line -> line.substring(DATA_PREFIX.length()).trim())
        .orElse("{}");
  }

  private HttpRequest.Builder newRequest(DataSourceEntity source) {
    URI uri = URI.create(source.getEndpoint().trim());
    boolean isHttp = "http".equals(uri.getScheme()) || "https".equals(uri.getScheme());
    if (!isHttp || uri.getHost() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The endpoint must be an http(s) URL.");
    }
    rejectLinkLocal(uri.getHost());
    return HttpRequest.newBuilder(uri).timeout(TIMEOUT);
  }

  /** Cloud metadata services live on link-local addresses: never a legitimate source. */
  private static void rejectLinkLocal(String host) {
    try {
      if (InetAddress.getByName(host).isLinkLocalAddress()) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This address is not allowed.");
      }
    } catch (java.net.UnknownHostException e) {
      throw badGateway("Unknown host: " + host);
    }
  }

  private HttpResponse<String> send(HttpRequest request) throws IOException, InterruptedException {
    HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() >= HTTP_REDIRECT_STATUS) {
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
      case API_KEY -> Map.of(apiKeyHeader(source), secret);
      case BASIC -> Map.of("Authorization", basicCredentials(source, secret));
      case NONE -> Map.of();
    };
  }

  private static String apiKeyHeader(DataSourceEntity source) {
    return StringUtils.hasText(source.getAuthHeaderName())
        ? source.getAuthHeaderName()
        : DEFAULT_API_KEY_HEADER;
  }

  private static String basicCredentials(DataSourceEntity source, String secret) {
    String username = source.getAuthUsername() != null ? source.getAuthUsername() : "";
    byte[] raw = (username + ":" + secret).getBytes(StandardCharsets.UTF_8);
    return "Basic " + Base64.getEncoder().encodeToString(raw);
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

  private List<Map<String, Object>> toRows(JsonNode array) {
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
