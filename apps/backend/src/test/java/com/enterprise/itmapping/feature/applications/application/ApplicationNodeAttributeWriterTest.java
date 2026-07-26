package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.neo4j.core.Neo4jClient;

@ExtendWith(MockitoExtension.class)
class ApplicationNodeAttributeWriterTest {

  @Test
  void writeSetsDynamicPropsOnApplication() {
    Neo4jClient neo4jClient = mock(Neo4jClient.class, RETURNS_DEEP_STUBS);
    ApplicationNodeAttributeWriter writer = new ApplicationNodeAttributeWriter(neo4jClient);

    int written =
        writer.write("app-1", Map.of("tier", "T1", "ignored", "x"), Set.of("tier"));

    assertThat(written).isEqualTo(1);
    ArgumentCaptor<String> cypherCaptor = ArgumentCaptor.forClass(String.class);
    verify(neo4jClient).query(cypherCaptor.capture());
    assertThat(cypherCaptor.getValue()).contains("MATCH (a:Application {id: $id})");
    assertThat(cypherCaptor.getValue()).contains("SET a += $dynamicProps");
  }

  @Test
  void writeSkipsWhenNoWhitelistedProps() {
    Neo4jClient neo4jClient = mock(Neo4jClient.class, RETURNS_DEEP_STUBS);
    ApplicationNodeAttributeWriter writer = new ApplicationNodeAttributeWriter(neo4jClient);

    int written = writer.write("app-1", Map.of("name", "hack"), Set.of("tier"));

    assertThat(written).isZero();
    verify(neo4jClient, never()).query(anyString());
  }

  @Test
  void writeSkipsEmptyApplicationId() {
    Neo4jClient neo4jClient = mock(Neo4jClient.class, RETURNS_DEEP_STUBS);
    ApplicationNodeAttributeWriter writer = new ApplicationNodeAttributeWriter(neo4jClient);

    assertThat(writer.write("", Map.of("tier", "T1"), Set.of("tier"))).isZero();
    verify(neo4jClient, never()).query(anyString());
  }
}
