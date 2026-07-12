package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery.CatalogRow;
import com.enterprise.itmapping.feature.applications.application.ConnectionDiscoveryAgent.DiscoveryResult;
import com.enterprise.itmapping.feature.applications.application.ApplicationConnectionEdgeWriter.Outcome;
import com.enterprise.itmapping.feature.applications.application.ApplicationConnectionEdgeWriter.WriteResult;
import com.enterprise.itmapping.feature.applications.application.dto.AiApplicationConnectionPayload;
import com.enterprise.itmapping.feature.applications.application.dto.AiApplicationConnectionPayload.AiConnectionEntry;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationGraphNodeProjection;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestConnectionsFromGithubRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestConnectionsFromGithubResponse;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubRepoCloneService;
import com.enterprise.itmapping.feature.integrations.llm.ConnectionDiscoveryProperties;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class ApplicationConnectionSuggestionServiceTest {

  private static final String APP_ID = "app-source";

  @Mock ApplicationRepository applicationRepository;
  @Mock GitHubRepoCloneService cloneService;
  @Mock ConnectionDiscoveryAgent agent;
  @Mock ApplicationCatalogQuery catalogQuery;
  @Mock ApplicationConnectionEdgeWriter edgeWriter;

  private ApplicationConnectionSuggestionService service;

  @BeforeEach
  void setUp() {
    ConnectionDiscoveryProperties props =
        new ConnectionDiscoveryProperties(35, 50, 12000, 500, 120, false, 500);
    service =
        new ApplicationConnectionSuggestionService(
            applicationRepository, cloneService, agent, props, catalogQuery, edgeWriter);

    lenient().when(applicationRepository.findProjectionById(APP_ID)).thenReturn(Optional.of(projection()));
    lenient().when(cloneService.clone(anyString(), anyString(), anyInt())).thenReturn(Path.of("dummy"));
    lenient()
        .when(catalogQuery.loadExcluding(APP_ID))
        .thenReturn(List.of(new CatalogRow("id-b", "Service B", "desc")));
  }

  @Test
  void outboundConnectionOrientsEdgeSourceToPeer() {
    stubAgent(connection("Service B", "outbound", "API", "https://b/api"));
    when(edgeWriter.createOrMerge(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), anyString()))
        .thenReturn(new WriteResult(Outcome.CREATED, "edge-1"));

    SuggestConnectionsFromGithubResponse res =
        service.suggestFromGithub(APP_ID, new SuggestConnectionsFromGithubRequest(null));

    ArgumentCaptor<String> src = ArgumentCaptor.forClass(String.class);
    ArgumentCaptor<String> tgt = ArgumentCaptor.forClass(String.class);
    org.mockito.Mockito.verify(edgeWriter)
        .createOrMerge(src.capture(), tgt.capture(), eq("API"), eq("https://b/api"), eq("outbound"), eq("high"), eq(APP_ID));
    assertThat(src.getValue()).isEqualTo(APP_ID);
    assertThat(tgt.getValue()).isEqualTo("id-b");
    assertThat(res.created()).hasSize(1);
    assertThat(res.created().get(0).direction()).isEqualTo("outbound");
  }

  @Test
  void inboundConnectionOrientsEdgePeerToSource() {
    stubAgent(connection("Service B", "inbound", "KAFKA", "topic.x"));
    when(edgeWriter.createOrMerge(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), anyString()))
        .thenReturn(new WriteResult(Outcome.CREATED, "edge-2"));

    service.suggestFromGithub(APP_ID, new SuggestConnectionsFromGithubRequest(null));

    ArgumentCaptor<String> src = ArgumentCaptor.forClass(String.class);
    ArgumentCaptor<String> tgt = ArgumentCaptor.forClass(String.class);
    org.mockito.Mockito.verify(edgeWriter)
        .createOrMerge(src.capture(), tgt.capture(), eq("KAFKA"), eq("topic.x"), eq("inbound"), eq("high"), eq(APP_ID));
    assertThat(src.getValue()).isEqualTo("id-b");
    assertThat(tgt.getValue()).isEqualTo(APP_ID);
  }

  @Test
  void duplicateEdgeIsSkipped() {
    stubAgent(connection("Service B", "outbound", "API", "x"));
    when(edgeWriter.createOrMerge(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), anyString()))
        .thenReturn(new WriteResult(Outcome.DUPLICATE, "edge-existing"));

    SuggestConnectionsFromGithubResponse res =
        service.suggestFromGithub(APP_ID, new SuggestConnectionsFromGithubRequest(null));

    assertThat(res.created()).isEmpty();
    assertThat(res.skipped()).anyMatch(s -> s.reason().equals("doublon"));
  }

  @Test
  void unknownPeerIsSkipped() {
    stubAgent(connection("Ghost App", "outbound", "API", "x"));

    SuggestConnectionsFromGithubResponse res =
        service.suggestFromGithub(APP_ID, new SuggestConnectionsFromGithubRequest(null));

    assertThat(res.created()).isEmpty();
    assertThat(res.skipped()).anyMatch(s -> s.reason().equals("peer_inconnu"));
    org.mockito.Mockito.verifyNoInteractions(edgeWriter);
  }

  @Test
  void invalidKindIsSkipped() {
    stubAgent(connection("Service B", "outbound", "TELEPATHY", "x"));

    SuggestConnectionsFromGithubResponse res =
        service.suggestFromGithub(APP_ID, new SuggestConnectionsFromGithubRequest(null));

    assertThat(res.created()).isEmpty();
    assertThat(res.skipped()).anyMatch(s -> s.reason().equals("kind_invalide"));
  }

  @Test
  void emptyCatalogIsBadRequest() {
    when(catalogQuery.loadExcluding(APP_ID)).thenReturn(List.of());

    assertThatThrownBy(
            () -> service.suggestFromGithub(APP_ID, new SuggestConnectionsFromGithubRequest(null)))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("Aucune autre application");
  }

  private void stubAgent(AiConnectionEntry... entries) {
    AiApplicationConnectionPayload payload = new AiApplicationConnectionPayload();
    payload.setConnections(new ArrayList<>(List.of(entries)));
    when(agent.discover(any(), anyString(), anyString(), anyString(), anyString()))
        .thenReturn(new DiscoveryResult(payload, List.of("README.md")));
  }

  private static AiConnectionEntry connection(
      String peer, String direction, String kind, String channel) {
    AiConnectionEntry e = new AiConnectionEntry();
    e.setPeerApplicationName(peer);
    e.setDirection(direction);
    e.setConnectionKind(kind);
    e.setChannel(channel);
    e.setConfidence("high");
    return e;
  }

  private static ApplicationGraphNodeProjection projection() {
    return new ApplicationGraphNodeProjection() {
      @Override
      public String getId() {
        return APP_ID;
      }

      @Override
      public String getName() {
        return "owner/repo";
      }

      @Override
      public String getDescription() {
        return null;
      }

      @Override
      public Integer getYear() {
        return 2024;
      }
    };
  }
}
