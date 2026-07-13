package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.neo4j.core.Neo4jClient;

@ExtendWith(MockitoExtension.class)
class ApplicationConnectionEdgeWriterTest {

  @Test
  void createUsesConnectionKindNotData() {
    Neo4jClient neo4jClient = mock(Neo4jClient.class, RETURNS_DEEP_STUBS);
    whenFetchEmpty(neo4jClient);
    ApplicationConnectionEdgeWriter writer = new ApplicationConnectionEdgeWriter(neo4jClient);

    writer.createOrMerge(
        "s1",
        "t1",
        "KAFKA",
        "orders.events",
        "outbound",
        "high",
        "app-1",
        Map.of("product_line", "ALPHA"),
        Set.of("product_line"));

    String createCypher = captureCypherContaining(neo4jClient, "CREATE (s)-[r:DEPENDS_ON");
    assertThat(createCypher).contains("connection_kind: $kind");
    assertThat(createCypher).doesNotContain("data: $kind");
    assertThat(createCypher).contains("SET r += $dynamicProps");
  }

  @Test
  void dedupQueryUsesConnectionKind() {
    Neo4jClient neo4jClient = mock(Neo4jClient.class, RETURNS_DEEP_STUBS);
    whenFetchEmpty(neo4jClient);
    ApplicationConnectionEdgeWriter writer = new ApplicationConnectionEdgeWriter(neo4jClient);

    writer.createOrMerge(
        "s1", "t1", "API", "", "outbound", "high", "app-1", Map.of(), Set.of());

    String dedupCypher = captureCypherContaining(neo4jClient, "coalesce(r.connection_kind");
    assertThat(dedupCypher).doesNotContain("r.data");
  }

  private static void whenFetchEmpty(Neo4jClient neo4jClient) {
    org.mockito.Mockito.when(neo4jClient.query(anyString()).bindAll(anyMap()).fetch().first())
        .thenReturn(Optional.empty());
  }

  private static String captureCypherContaining(Neo4jClient neo4jClient, String needle) {
    ArgumentCaptor<String> cypherCaptor = ArgumentCaptor.forClass(String.class);
    verify(neo4jClient, org.mockito.Mockito.atLeastOnce()).query(cypherCaptor.capture());
    return cypherCaptor.getAllValues().stream()
        .filter(c -> c.contains(needle))
        .findFirst()
        .orElseThrow();
  }
}
