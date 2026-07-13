package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anySet;
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
import com.enterprise.itmapping.feature.datamodel.application.DataModelAttributeResolver;
import com.enterprise.itmapping.feature.datamodel.application.DataModelPromptBuilder;
import com.enterprise.itmapping.feature.datamodel.application.DataModelService;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubRepoCloneService;
import com.enterprise.itmapping.feature.integrations.llm.ConnectionDiscoveryProperties;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
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
  @Mock DataModelService dataModelService;
  @Mock DataModelPromptBuilder dataModelPromptBuilder;
  @Mock DataModelAttributeResolver dataModelAttributeResolver;

  private ApplicationConnectionSuggestionService service;

  @BeforeEach
  void setUp() {
    ConnectionDiscoveryProperties props =
        new ConnectionDiscoveryProperties(35, 50, 12000, 500, 120, false, 500);
    service =
        new ApplicationConnectionSuggestionService(
            applicationRepository,
            cloneService,
            agent,
            props,
            catalogQuery,
            edgeWriter,
            dataModelService,
            dataModelPromptBuilder,
            dataModelAttributeResolver);

    lenient().when(applicationRepository.findProjectionById(APP_ID)).thenReturn(Optional.of(projection()));
    lenient().when(cloneService.clone(anyString(), anyString(), anyInt())).thenReturn(Path.of("dummy"));
    lenient()
        .when(catalogQuery.loadExcluding(APP_ID))
        .thenReturn(List.of(new CatalogRow("id-b", "Service B", "desc")));
    lenient().when(dataModelService.loadConfig()).thenReturn(new DataModelConfig(List.of()));
    lenient().when(dataModelPromptBuilder.buildPromptSection(any())).thenReturn("");
    lenient().when(dataModelAttributeResolver.allowedKeys(any())).thenReturn(Set.of());
  }

  @Test
  void outboundConnectionOrientsEdgeSourceToPeer() {
    stubAgent(connection("Service B", "outbound", "API", "https://b/api"));
    when(edgeWriter.createOrMerge(
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            any(),
            anySet()))
        .thenReturn(new WriteResult(Outcome.CREATED, "edge-1"));

    SuggestConnectionsFromGithubResponse res =
        service.suggestFromGithub(APP_ID, new SuggestConnectionsFromGithubRequest(null));

    ArgumentCaptor<String> src = ArgumentCaptor.forClass(String.class);
    ArgumentCaptor<String> tgt = ArgumentCaptor.forClass(String.class);
    org.mockito.Mockito.verify(edgeWriter)
        .createOrMerge(
            src.capture(),
            tgt.capture(),
            eq("API"),
            eq("https://b/api"),
            eq("outbound"),
            eq("high"),
            eq(APP_ID),
            eq(Map.of()),
            eq(Set.of()));
    assertThat(src.getValue()).isEqualTo(APP_ID);
    assertThat(tgt.getValue()).isEqualTo("id-b");
    assertThat(res.created()).hasSize(1);
    assertThat(res.created().get(0).direction()).isEqualTo("outbound");
  }

  @Test
  void inboundConnectionOrientsEdgePeerToSource() {
    stubAgent(connection("Service B", "inbound", "KAFKA", "topic.x"));
    when(edgeWriter.createOrMerge(
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            any(),
            anySet()))
        .thenReturn(new WriteResult(Outcome.CREATED, "edge-2"));

    service.suggestFromGithub(APP_ID, new SuggestConnectionsFromGithubRequest(null));

    ArgumentCaptor<String> src = ArgumentCaptor.forClass(String.class);
    ArgumentCaptor<String> tgt = ArgumentCaptor.forClass(String.class);
    org.mockito.Mockito.verify(edgeWriter)
        .createOrMerge(
            src.capture(),
            tgt.capture(),
            eq("KAFKA"),
            eq("topic.x"),
            eq("inbound"),
            eq("high"),
            eq(APP_ID),
            eq(Map.of()),
            eq(Set.of()));
    assertThat(src.getValue()).isEqualTo("id-b");
    assertThat(tgt.getValue()).isEqualTo(APP_ID);
  }

  @Test
  void duplicateEdgeIsSkipped() {
    stubAgent(connection("Service B", "outbound", "API", "x"));
    when(edgeWriter.createOrMerge(
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            any(),
            anySet()))
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

  @Test
  void withoutDataModelIgnoresEdgeAttributesFromLlm() {
    AiConnectionEntry entry = connection("Service B", "outbound", "API", "x");
    entry.setEdgeAttributes(Map.of("product_line", "ALPHA"));
    stubAgent(entry);
    when(edgeWriter.createOrMerge(
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            any(),
            anySet()))
        .thenReturn(new WriteResult(Outcome.CREATED, "edge-1"));

    service.suggestFromGithub(APP_ID, new SuggestConnectionsFromGithubRequest(null));

    org.mockito.Mockito.verify(edgeWriter)
        .createOrMerge(
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            eq(Map.of()),
            eq(Set.of()));
  }

  @Test
  void withDataModelSkipsInvalidEnumValue() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(
                new DataModelField(
                    "product_line", "Ligne", "", "", List.of("ALPHA"), true, false)));
    when(dataModelService.loadConfig()).thenReturn(config);
    when(dataModelPromptBuilder.buildPromptSection(config)).thenReturn("## Active Data Model");
    when(dataModelAttributeResolver.allowedKeys(config)).thenReturn(Set.of("product_line"));
    when(dataModelAttributeResolver.validate(eq(config), any()))
        .thenReturn(
            new DataModelAttributeResolver.ValidationResult(
                false, Map.of(), "data_model_valeur_invalide", "product_line=BAD"));

    AiConnectionEntry entry = connection("Service B", "outbound", "API", "x");
    entry.setEdgeAttributes(Map.of("product_line", "BAD"));
    stubAgent(entry);

    SuggestConnectionsFromGithubResponse res =
        service.suggestFromGithub(APP_ID, new SuggestConnectionsFromGithubRequest(null));

    assertThat(res.created()).isEmpty();
    assertThat(res.skipped()).anyMatch(s -> s.reason().equals("data_model_valeur_invalide"));
    org.mockito.Mockito.verifyNoInteractions(edgeWriter);
  }

  @Test
  void withDataModelSkipsWhenRequiredFieldMissing() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(new DataModelField("flow_nature", "Nature", "", "", List.of(), false, true)));
    when(dataModelService.loadConfig()).thenReturn(config);
    when(dataModelPromptBuilder.buildPromptSection(config)).thenReturn("## Active Data Model");
    when(dataModelAttributeResolver.allowedKeys(config)).thenReturn(Set.of("flow_nature"));
    when(dataModelAttributeResolver.validate(eq(config), any()))
        .thenReturn(
            new DataModelAttributeResolver.ValidationResult(
                false, Map.of(), "data_model_champ_manquant", "flow_nature"));

    stubAgent(connection("Service B", "outbound", "API", "x"));

    SuggestConnectionsFromGithubResponse res =
        service.suggestFromGithub(APP_ID, new SuggestConnectionsFromGithubRequest(null));

    assertThat(res.created()).isEmpty();
    assertThat(res.skipped()).anyMatch(s -> s.reason().equals("data_model_champ_manquant"));
  }

  @Test
  void withDataModelPersistsValidatedAttributes() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(
                new DataModelField(
                    "product_line", "Ligne", "", "", List.of("ALPHA"), true, false)));
    when(dataModelService.loadConfig()).thenReturn(config);
    when(dataModelPromptBuilder.buildPromptSection(config)).thenReturn("## Active Data Model");
    when(dataModelAttributeResolver.allowedKeys(config)).thenReturn(Set.of("product_line"));
    Map<String, String> attrs = Map.of("product_line", "ALPHA");
    when(dataModelAttributeResolver.validate(eq(config), any()))
        .thenReturn(new DataModelAttributeResolver.ValidationResult(true, attrs, null, null));

    AiConnectionEntry entry = connection("Service B", "outbound", "API", "x");
    entry.setEdgeAttributes(attrs);
    stubAgent(entry);
    when(edgeWriter.createOrMerge(
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            any(),
            anySet()))
        .thenReturn(new WriteResult(Outcome.CREATED, "edge-1"));

    service.suggestFromGithub(APP_ID, new SuggestConnectionsFromGithubRequest(null));

    org.mockito.Mockito.verify(edgeWriter)
        .createOrMerge(
            anyString(),
            anyString(),
            eq("API"),
            anyString(),
            anyString(),
            anyString(),
            eq(APP_ID),
            eq(attrs),
            eq(Set.of("product_line")));
  }

  private void stubAgent(AiConnectionEntry... entries) {
    AiApplicationConnectionPayload payload = new AiApplicationConnectionPayload();
    payload.setConnections(new ArrayList<>(List.of(entries)));
    when(agent.discover(any(), anyString(), anyString(), anyString(), anyString(), anyString()))
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
