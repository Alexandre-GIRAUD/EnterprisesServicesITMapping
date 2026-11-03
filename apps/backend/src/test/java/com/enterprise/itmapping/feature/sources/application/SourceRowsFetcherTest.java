package com.enterprise.itmapping.feature.sources.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.enterprise.itmapping.feature.sources.domain.SourceAuthType;
import com.enterprise.itmapping.feature.sources.domain.SourceKind;
import com.enterprise.itmapping.feature.sources.infrastructure.persistence.DataSourceEntity;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class SourceRowsFetcherTest {

  private final SourceRowsFetcher fetcher = new SourceRowsFetcher(new ObjectMapper());
  private HttpServer server;

  @BeforeEach
  void startServer() throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.start();
  }

  @AfterEach
  void stopServer() {
    server.stop(0);
  }

  @Test
  void apiSourceSendsTheBearerSecretAndReadsTheListAtThePath() {
    AtomicReference<String> authorization = new AtomicReference<>();
    server.createContext(
        "/rows",
        exchange -> {
          authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
          reply(exchange, 200, "application/json", "{\"data\":{\"items\":[{\"ref\":\"app__1\"}]}}");
        });
    DataSourceEntity source = source(SourceKind.API, "/rows");
    source.setAuthType(SourceAuthType.BEARER);
    source.setItemsPath("data.items");

    List<Map<String, Object>> rows = fetcher.fetch(source, "s3cret");

    assertThat(rows).containsExactly(Map.of("ref", "app__1"));
    assertThat(authorization.get()).isEqualTo("Bearer s3cret");
  }

  @Test
  void apiKeySourceUsesTheConfiguredHeader() {
    AtomicReference<String> key = new AtomicReference<>();
    server.createContext(
        "/rows",
        exchange -> {
          key.set(exchange.getRequestHeaders().getFirst("X-Token"));
          reply(exchange, 200, "application/json", "[]");
        });
    DataSourceEntity source = source(SourceKind.API, "/rows");
    source.setAuthType(SourceAuthType.API_KEY);
    source.setAuthHeaderName("X-Token");

    fetcher.fetch(source, "abc");

    assertThat(key.get()).isEqualTo("abc");
  }

  @Test
  void mcpSourceCallsTheToolAndReadsAnEventStreamReply() {
    AtomicReference<String> calledTool = new AtomicReference<>();
    server.createContext(
        "/mcp",
        exchange -> {
          String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
          if (body.contains("\"initialize\"")) {
            exchange.getResponseHeaders().add("Mcp-Session-Id", "sess-1");
            reply(exchange, 200, "application/json", "{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{}}");
          } else if (body.contains("notifications/initialized")) {
            reply(exchange, 202, "application/json", "");
          } else {
            calledTool.set(exchange.getRequestHeaders().getFirst("Mcp-Session-Id") + body);
            reply(
                exchange,
                200,
                "text/event-stream",
                "event: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":2,\"result\":{\"content\":"
                    + "[{\"type\":\"text\",\"text\":\"[{\\\"ref\\\":\\\"a\\\"}]\"}]}}\n\n");
          }
        });
    DataSourceEntity source = source(SourceKind.MCP, "/mcp");
    source.setToolName("list_apps");

    List<Map<String, Object>> rows = fetcher.fetch(source, null);

    assertThat(rows).containsExactly(Map.of("ref", "a"));
    assertThat(calledTool.get()).startsWith("sess-1").contains("list_apps");
  }

  @Test
  void refusesLinkLocalAddressesAndNonHttpSchemes() {
    DataSourceEntity metadata = source(SourceKind.API, "/");
    metadata.setEndpoint("http://169.254.169.254/latest/meta-data");
    DataSourceEntity file = source(SourceKind.API, "/");
    file.setEndpoint("file:///etc/passwd");

    assertThatThrownBy(() -> fetcher.fetch(metadata, null))
        .isInstanceOf(ResponseStatusException.class);
    assertThatThrownBy(() -> fetcher.fetch(file, null)).isInstanceOf(ResponseStatusException.class);
  }

  @Test
  void anErrorStatusIsReportedAsABadGateway() {
    server.createContext("/rows", exchange -> reply(exchange, 500, "application/json", "{}"));

    assertThatThrownBy(() -> fetcher.fetch(source(SourceKind.API, "/rows"), null))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("HTTP 500");
  }

  private DataSourceEntity source(SourceKind kind, String path) {
    DataSourceEntity source = new DataSourceEntity();
    source.setKind(kind);
    source.setEndpoint("http://127.0.0.1:" + server.getAddress().getPort() + path);
    return source;
  }

  private static void reply(
      com.sun.net.httpserver.HttpExchange exchange, int status, String type, String body)
      throws IOException {
    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().add("Content-Type", type);
    exchange.sendResponseHeaders(status, bytes.length == 0 ? -1 : bytes.length);
    if (bytes.length > 0) {
      exchange.getResponseBody().write(bytes);
    }
    exchange.close();
  }
}
