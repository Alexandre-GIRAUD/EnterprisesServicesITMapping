package com.enterprise.itmapping;

import com.enterprise.itmapping.domain.Application;
import com.enterprise.itmapping.feature.applications.application.ApplicationService;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationRequest;
import com.enterprise.itmapping.feature.graph.application.GraphService;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import com.enterprise.itmapping.feature.graph.application.dto.VersionSnapshotDto;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.Neo4jContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Testcontainers
class TemporalQueryTest {

  @Container
  static Neo4jContainer<?> neo4j = new Neo4jContainer<>(DockerImageName.parse("neo4j:5-community"))
      .withAdminPassword("password");

  @DynamicPropertySource
  static void neo4jProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.neo4j.uri", neo4j::getBoltUrl);
    registry.add("spring.neo4j.authentication.username", () -> "neo4j");
    registry.add("spring.neo4j.authentication.password", neo4j::getAdminPassword);
    registry.add("app.sample-data.seed", () -> "false");
  }

  @Autowired
  ApplicationRepository applicationRepository;

  @Autowired
  ApplicationService applicationService;

  @Autowired
  GraphService graphService;

  @Nested
  @DisplayName("getGraphAtDate")
  class GetGraphAtDate {

    @Test
    @DisplayName("returns only nodes and relationships valid at the given date")
    void returnsOnlyValidAtDate() {
      Instant past = Instant.parse("2024-01-01T00:00:00Z");
      Instant future = Instant.parse("2024-06-01T00:00:00Z");

      Application onlyInPast = new Application();
      onlyInPast.setName("PastApp");
      onlyInPast.setValidFrom(past);
      onlyInPast.setValidTo(Instant.parse("2024-03-01T00:00:00Z"));
      applicationRepository.save(onlyInPast);

      Application current = new Application();
      current.setName("CurrentApp");
      current.setValidFrom(past);
      current.setValidTo(null);
      applicationRepository.save(current);

      Date queryDate = Date.from(Instant.parse("2024-02-15T00:00:00Z"));
      GraphResponseDto graph = graphService.getGraphAtDate(queryDate);

      assertThat(graph.nodes()).hasSize(2);
      assertThat(graph.nodes().stream().map(n -> n.label()).toList())
          .containsExactlyInAnyOrder("PastApp", "CurrentApp");

      Date afterPastEnd = Date.from(Instant.parse("2024-04-01T00:00:00Z"));
      GraphResponseDto graphLater = graphService.getGraphAtDate(afterPastEnd);
      assertThat(graphLater.nodes()).hasSize(1);
      assertThat(graphLater.nodes().getFirst().label()).isEqualTo("CurrentApp");
    }

    @Test
    @DisplayName("returns empty graph when no nodes valid at date")
    void returnsEmptyWhenNoneValid() {
      Application app = new Application();
      app.setName("FutureApp");
      app.setValidFrom(Instant.parse("2030-01-01T00:00:00Z"));
      app.setValidTo(null);
      applicationRepository.save(app);

      Date queryDate = Date.from(Instant.parse("2020-01-01T00:00:00Z"));
      GraphResponseDto graph = graphService.getGraphAtDate(queryDate);

      assertThat(graph.nodes()).isEmpty();
      assertThat(graph.edges()).isEmpty();
    }
  }

  @Nested
  @DisplayName("createNewSnapshot")
  class CreateNewSnapshot {

    @Test
    @DisplayName("creates VersionSnapshot and links all current valid nodes")
    void createsSnapshotAndLinksCurrentNodes() {
      Application app = new Application();
      app.setName("SnapshotTestApp");
      app.setValidFrom(Instant.now().minusSeconds(3600));
      app.setValidTo(null);
      applicationRepository.save(app);

      VersionSnapshotDto snapshot = graphService.createNewSnapshot("v1.0");

      assertThat(snapshot.id()).isNotBlank();
      assertThat(snapshot.versionTag()).isEqualTo("v1.0");
      assertThat(snapshot.validFrom()).isNotNull();
      assertThat(snapshot.validTo()).isNull();
      assertThat(snapshot.linkedNodeCount()).isGreaterThanOrEqualTo(1);
    }

    @Test
    @DisplayName("links only nodes with validTo IS NULL")
    void linksOnlyCurrentNodes() {
      Application current = new Application();
      current.setName("Current");
      current.setValidFrom(Instant.now().minusSeconds(3600));
      current.setValidTo(null);
      applicationRepository.save(current);

      Application closed = new Application();
      closed.setName("Closed");
      closed.setValidFrom(Instant.now().minusSeconds(7200));
      closed.setValidTo(Instant.now().minusSeconds(1800));
      applicationRepository.save(closed);

      VersionSnapshotDto snapshot = graphService.createNewSnapshot("v2");

      assertThat(snapshot.linkedNodeCount()).isEqualTo(1);
    }
  }

  @Nested
  @DisplayName("soft-update")
  class SoftUpdate {

    @Test
    @DisplayName("sets previous validTo and creates new version with validFrom")
    void closesCurrentAndCreatesNewVersion() {
      ApplicationRequest create = new ApplicationRequest("Original", null, null, null);
      com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationResponse created =
          applicationService.create(create);
      String originalId = created.id();

      ApplicationRequest update = new ApplicationRequest("Updated", "desc", null, null);
      var updated = applicationService.softUpdate(originalId, update);

      assertThat(updated).isPresent();
      assertThat(updated.get().id()).isNotEqualTo(originalId);
      assertThat(updated.get().name()).isEqualTo("Updated");
      assertThat(updated.get().validTo()).isNull();

      com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationResponse oldVersion =
          applicationService.findById(originalId, null).orElseThrow();
      assertThat(oldVersion.validTo()).isNotNull();
      assertThat(oldVersion.name()).isEqualTo("Original");
    }

    @Test
    @DisplayName("returns empty when no current version exists for id")
    void returnsEmptyWhenNotCurrent() {
      Application app = new Application();
      app.setName("Closed");
      app.setValidFrom(Instant.now().minusSeconds(3600));
      app.setValidTo(Instant.now().minusSeconds(1800));
      applicationRepository.save(app);

      ApplicationRequest update = new ApplicationRequest("Try", null, null, null);
      var result = applicationService.softUpdate(app.getId(), update);

      assertThat(result).isEmpty();
    }
  }
}
