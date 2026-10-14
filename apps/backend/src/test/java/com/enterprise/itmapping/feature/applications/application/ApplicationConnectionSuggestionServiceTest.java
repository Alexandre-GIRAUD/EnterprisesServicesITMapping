package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery.CatalogRow;
import com.enterprise.itmapping.feature.applications.application.ApplicationConnectionEdgeWriter.Outcome;
import com.enterprise.itmapping.feature.applications.application.ApplicationConnectionEdgeWriter.WriteResult;
import com.enterprise.itmapping.feature.applications.application.ConnectionDiscoveryAgent.DiscoveryResult;
import com.enterprise.itmapping.feature.applications.application.dto.AiApplicationConnectionPayload;
import com.enterprise.itmapping.feature.applications.application.dto.AiApplicationConnectionPayload.AiConnectionEntry;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationGraphNodeProjection;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestConnectionsFromGithubRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestConnectionsFromGithubResponse;
import com.enterprise.itmapping.feature.attributeaudit.application.AttributeChangeAuditService;
import com.enterprise.itmapping.feature.attributeaudit.application.HumanFieldOverrideGuard;
import com.enterprise.itmapping.feature.datamodel.application.DataModelAttributeResolver;
import com.enterprise.itmapping.feature.datamodel.application.DataModelPromptBuilder;
import com.enterprise.itmapping.feature.datamodel.application.DataModelService;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelDetection;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelTarget;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.AiDecisionSourceEntity;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.AiDecisionSourceRepository;
import com.enterprise.itmapping.feature.graph.application.GraphEdgeAttributeReader;
import com.enterprise.itmapping.feature.graph.application.GraphEdgeLinkService;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubRepoCloneService;
import com.enterprise.itmapping.feature.integrations.llm.ConnectionDiscoveryProperties;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.mockito.stubbing.Answer;
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
  @Mock ApplicationNodeAttributePatchService nodeAttributePatchService;
  @Mock ApplicationNodeRefLinkWriter nodeRefLinkWriter;
  @Mock GraphEdgeAttributeReader edgeAttributeReader;
  @Mock AttributeChangeAuditService attributeChangeAuditService;
  @Mock GraphEdgeLinkService edgeLinkService;
  @Mock HumanFieldOverrideGuard overrideGuard;
  @Mock DataModelService dataModelService;
  @Mock DataModelPromptBuilder dataModelPromptBuilder;
  @Mock DataModelAttributeResolver dataModelAttributeResolver;
  @Mock AiDecisionSourceRepository decisionSourceRepository;
  @Mock ApplicationNodeRefLinkReader nodeRefLinkReader;

  private final List<AiDecisionSourceEntity> storedSources = new ArrayList<>();
  private AiDecisionSourceService decisionSources;
  private ApplicationConnectionSuggestionService service;

  @BeforeEach
  void setUp() {
    ConnectionDiscoveryProperties props =
        new ConnectionDiscoveryProperties(35, 50, 12000, 500, 120, false, 500);
    storedSources.clear();
    decisionSources = new AiDecisionSourceService(decisionSourceRepository);
    lenient()
        .when(decisionSourceRepository.save(any(AiDecisionSourceEntity.class)))
        .thenAnswer(storeSource());
    lenient()
        .when(
            decisionSourceRepository.findByTargetTypeAndTargetIdOrderByCreatedAtAsc(
                anyString(), anyString()))
        .thenAnswer(listSources());
    service =
        new ApplicationConnectionSuggestionService(
            applicationRepository,
            cloneService,
            agent,
            props,
            catalogQuery,
            edgeWriter,
            nodeAttributePatchService,
            nodeRefLinkWriter,
            edgeAttributeReader,
            attributeChangeAuditService,
            edgeLinkService,
            overrideGuard,
            dataModelService,
            dataModelPromptBuilder,
            dataModelAttributeResolver,
            decisionSources,
            nodeRefLinkReader);

    lenient().when(applicationRepository.findProjectionById(APP_ID)).thenReturn(Optional.of(projection()));
    lenient().when(cloneService.clone(anyString(), anyString(), anyInt())).thenReturn(Path.of("dummy"));
    lenient()
        .when(catalogQuery.loadExcluding(APP_ID))
        .thenReturn(List.of(new CatalogRow("id-b", "Service B", "desc")));
    lenient().when(dataModelService.loadConfig()).thenReturn(new DataModelConfig(List.of()));
    lenient().when(dataModelPromptBuilder.buildPromptSection(any())).thenReturn("");
    lenient()
        .when(dataModelAttributeResolver.allowedKeys(any(), eq(DataModelTarget.EDGE)))
        .thenReturn(Set.of());
    lenient()
        .when(dataModelAttributeResolver.allowedKeys(any(), eq(DataModelTarget.NODE)))
        .thenReturn(Set.of());
    lenient().when(edgeWriter.findBareEdgeId(anyString(), anyString())).thenReturn(Optional.empty());
    lenient().when(edgeAttributeReader.read(anyString())).thenReturn(Map.of());
    lenient()
        .when(overrideGuard.checkAiWrite(any(), anyString(), any(), anyString(), any(), anyString()))
        .thenReturn(HumanFieldOverrideGuard.Decision.ALLOW);
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
    verify(edgeWriter)
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
    verify(nodeAttributePatchService, never()).patchAi(anyString(), any(), anyString());
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
    verify(edgeWriter)
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

    verify(edgeWriter)
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
  void withOnlyManualDataModelFieldsIgnoresEdgeAttributes() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(
                new DataModelField(
                    "owner_note",
                    "Note",
                    "",
                    "",
                    List.of(),
                    false,
                    true,
                    DataModelDetection.MANUAL)));
    when(dataModelService.loadConfig()).thenReturn(config);

    AiConnectionEntry entry = connection("Service B", "outbound", "API", "x");
    entry.setEdgeAttributes(Map.of("owner_note", "should-ignore"));
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

    verify(edgeWriter)
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
    verify(dataModelAttributeResolver, never()).validate(any(), any(), eq(DataModelTarget.EDGE));
    verify(nodeAttributePatchService, never()).patchAi(anyString(), any(), anyString());
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
    when(dataModelAttributeResolver.allowedKeys(config, DataModelTarget.EDGE))
        .thenReturn(Set.of("product_line"));
    when(dataModelAttributeResolver.validate(eq(config), any(), eq(DataModelTarget.EDGE)))
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
    when(dataModelAttributeResolver.allowedKeys(config, DataModelTarget.EDGE))
        .thenReturn(Set.of("flow_nature"));
    when(dataModelAttributeResolver.validate(eq(config), any(), eq(DataModelTarget.EDGE)))
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
    when(dataModelAttributeResolver.allowedKeys(config, DataModelTarget.EDGE))
        .thenReturn(Set.of("product_line"));
    Map<String, String> attrs = Map.of("product_line", "ALPHA");
    when(dataModelAttributeResolver.validate(eq(config), any(), eq(DataModelTarget.EDGE)))
        .thenReturn(
            new DataModelAttributeResolver.ValidationResult(
                true, Map.of("product_line", List.of("ALPHA")), null, null));

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

    verify(edgeWriter)
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

  @Test
  void withNodeAutomaticPersistsValidatedNodeAttributes() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(
                new DataModelField(
                    "tier",
                    "Tier",
                    "",
                    "",
                    List.of("T1"),
                    true,
                    false,
                    DataModelDetection.AUTOMATIC_DETECTION,
                    DataModelTarget.NODE)));
    when(dataModelService.loadConfig()).thenReturn(config);
    when(dataModelPromptBuilder.buildPromptSection(config))
        .thenReturn("## Active Data Model (application node enrichment)");
    when(dataModelAttributeResolver.allowedKeys(config, DataModelTarget.NODE))
        .thenReturn(Set.of("tier"));
    Map<String, List<String>> nodeAttrs = Map.of("tier", List.of("T1"));
    when(dataModelAttributeResolver.validate(eq(config), any(), eq(DataModelTarget.NODE)))
        .thenReturn(new DataModelAttributeResolver.ValidationResult(true, nodeAttrs, null, null));

    AiApplicationConnectionPayload payload = new AiApplicationConnectionPayload();
    payload.setConnections(
        new ArrayList<>(List.of(connection("Service B", "outbound", "API", "x"))));
    payload.setNodeAttributes(Map.of("tier", "T1"));
    when(agent.discover(any(), anyString(), anyString(), anyString(), anyString(), anyString()))
        .thenReturn(new DiscoveryResult(payload, List.of("README.md")));
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

    assertThat(res.created()).hasSize(1);
    verify(nodeAttributePatchService).patchAi(APP_ID, nodeAttrs, "CONNECTION_SUGGESTION");
    verify(dataModelAttributeResolver, never()).validate(any(), any(), eq(DataModelTarget.EDGE));
  }

  @Test
  void withNodeManualIgnoresNodeAttributes() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(
                new DataModelField(
                    "tier",
                    "Tier",
                    "",
                    "",
                    List.of("T1"),
                    true,
                    false,
                    DataModelDetection.MANUAL,
                    DataModelTarget.NODE)));
    when(dataModelService.loadConfig()).thenReturn(config);

    AiApplicationConnectionPayload payload = new AiApplicationConnectionPayload();
    payload.setConnections(
        new ArrayList<>(List.of(connection("Service B", "outbound", "API", "x"))));
    payload.setNodeAttributes(Map.of("tier", "T1"));
    when(agent.discover(any(), anyString(), anyString(), anyString(), anyString(), anyString()))
        .thenReturn(new DiscoveryResult(payload, List.of()));
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

    verify(nodeAttributePatchService, never()).patchAi(anyString(), any(), anyString());
    verify(dataModelAttributeResolver, never()).validate(any(), any(), eq(DataModelTarget.NODE));
  }

  @Test
  void nodeValidationFailureDoesNotBlockEdges() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(
                new DataModelField(
                    "product_line",
                    "Line",
                    "",
                    "",
                    List.of("A"),
                    true,
                    false,
                    DataModelDetection.AUTOMATIC_DETECTION,
                    DataModelTarget.EDGE),
                new DataModelField(
                    "tier",
                    "Tier",
                    "",
                    "",
                    List.of("T1"),
                    true,
                    false,
                    DataModelDetection.AUTOMATIC_DETECTION,
                    DataModelTarget.NODE)));
    when(dataModelService.loadConfig()).thenReturn(config);
    when(dataModelAttributeResolver.allowedKeys(config, DataModelTarget.EDGE))
        .thenReturn(Set.of("product_line"));
    when(dataModelAttributeResolver.validate(eq(config), any(), eq(DataModelTarget.EDGE)))
        .thenReturn(
            new DataModelAttributeResolver.ValidationResult(
                true, Map.of("product_line", List.of("A")), null, null));
    when(dataModelAttributeResolver.validate(eq(config), any(), eq(DataModelTarget.NODE)))
        .thenReturn(
            new DataModelAttributeResolver.ValidationResult(
                false, Map.of(), "data_model_node_valeur_invalide", "tier=BAD"));

    AiConnectionEntry entry = connection("Service B", "outbound", "API", "x");
    entry.setEdgeAttributes(Map.of("product_line", "A"));
    AiApplicationConnectionPayload payload = new AiApplicationConnectionPayload();
    payload.setConnections(new ArrayList<>(List.of(entry)));
    payload.setNodeAttributes(Map.of("tier", "BAD"));
    when(agent.discover(any(), anyString(), anyString(), anyString(), anyString(), anyString()))
        .thenReturn(new DiscoveryResult(payload, List.of()));
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

    assertThat(res.created()).hasSize(1);
    verify(nodeAttributePatchService, never()).patchAi(anyString(), any(), anyString());
  }

  @Test
  void createdEdgeKeepsGroundedFilesForTheEdgeAndChangedProperties() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(
                new DataModelField(
                    "product_line", "Ligne", "", "", List.of("ALPHA"), true, false),
                new DataModelField(
                    "tier",
                    "Tier",
                    "",
                    "",
                    List.of("T1"),
                    true,
                    false,
                    DataModelDetection.AUTOMATIC_DETECTION,
                    DataModelTarget.NODE)));
    when(dataModelService.loadConfig()).thenReturn(config);
    when(dataModelAttributeResolver.allowedKeys(config, DataModelTarget.EDGE))
        .thenReturn(Set.of("product_line"));
    when(dataModelAttributeResolver.validate(eq(config), any(), eq(DataModelTarget.EDGE)))
        .thenReturn(
            new DataModelAttributeResolver.ValidationResult(
                true, Map.of("product_line", List.of("ALPHA")), null, null));
    when(dataModelAttributeResolver.validate(eq(config), any(), eq(DataModelTarget.NODE)))
        .thenReturn(
            new DataModelAttributeResolver.ValidationResult(
                true, Map.of("tier", List.of("T1")), null, null));
    when(nodeAttributePatchService.patchAi(eq(APP_ID), any(), eq("CONNECTION_SUGGESTION")))
        .thenReturn(Set.of("tier"));

    AiConnectionEntry entry = connection("Service B", "outbound", "API", "x");
    entry.setEdgeAttributes(Map.of("product_line", "ALPHA"));
    entry.setSourceFiles(List.of("./src/OrdersClient.java", "src/Missing.java", "../secret.txt"));
    AiApplicationConnectionPayload payload = new AiApplicationConnectionPayload();
    payload.setConnections(new ArrayList<>(List.of(entry)));
    payload.setNodeAttributes(Map.of("tier", "T1"));
    payload.setNodeSourceFiles(List.of("README.md"));
    when(agent.discover(any(), anyString(), anyString(), anyString(), anyString(), anyString()))
        .thenReturn(
            new DiscoveryResult(
                payload,
                List.of("README.md"),
                List.of("README.md", "src/OrdersClient.java")));
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

    assertThat(decisionSources.list(AiDecisionSourceService.TARGET_EDGE, "edge-1"))
        .extracting(AiDecisionSourceService.Trace::decisionKind, AiDecisionSourceService.Trace::fieldKey)
        .containsExactly(
            org.assertj.core.groups.Tuple.tuple(AiDecisionSourceService.KIND_EDGE_PROPERTY, "product_line"),
            org.assertj.core.groups.Tuple.tuple(
                AiDecisionSourceService.KIND_EDGE, GraphEdgeLinkService.LINK_FIELD_KEY));
    assertThat(decisionSources.list(AiDecisionSourceService.TARGET_EDGE, "edge-1"))
        .allSatisfy(
            trace -> {
              assertThat(trace.sourceFiles()).containsExactly("src/OrdersClient.java");
              assertThat(trace.repositoryName()).isEqualTo("owner/repo");
            });
    assertThat(decisionSources.list(AiDecisionSourceService.TARGET_APPLICATION, APP_ID))
        .singleElement()
        .satisfies(
            trace -> {
              assertThat(trace.decisionKind()).isEqualTo(AiDecisionSourceService.KIND_NODE_PROPERTY);
              assertThat(trace.fieldKey()).isEqualTo("tier");
              assertThat(trace.sourceFiles()).containsExactly("README.md");
            });
  }

  @Test
  void duplicateEdgeAndUnchangedAttributeLeaveNoSourceTrace() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(
                new DataModelField(
                    "product_line", "Ligne", "", "", List.of("ALPHA"), true, false)));
    when(dataModelService.loadConfig()).thenReturn(config);
    when(dataModelAttributeResolver.allowedKeys(config, DataModelTarget.EDGE))
        .thenReturn(Set.of("product_line"));
    when(dataModelAttributeResolver.validate(eq(config), any(), eq(DataModelTarget.EDGE)))
        .thenReturn(
            new DataModelAttributeResolver.ValidationResult(
                true, Map.of("product_line", List.of("ALPHA")), null, null));
    when(edgeWriter.findBareEdgeId(anyString(), anyString())).thenReturn(Optional.of("edge-existing"));
    when(edgeAttributeReader.read("edge-existing")).thenReturn(Map.of("product_line", "ALPHA"));

    AiConnectionEntry duplicate = connection("Service B", "outbound", "API", "x");
    duplicate.setSourceFiles(List.of("src/Dup.java"));
    AiConnectionEntry merged = connection("Service B", "inbound", "KAFKA", "topic");
    merged.setEdgeAttributes(Map.of("product_line", "ALPHA"));
    merged.setSourceFiles(List.of("src/Same.java"));
    when(agent.discover(any(), anyString(), anyString(), anyString(), anyString(), anyString()))
        .thenReturn(
            new DiscoveryResult(
                payloadOf(duplicate, merged),
                List.of("src/Dup.java", "src/Same.java"),
                List.of("src/Dup.java", "src/Same.java")));
    when(edgeWriter.createOrMerge(
            eq(APP_ID),
            eq("id-b"),
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            any(),
            anySet()))
        .thenReturn(new WriteResult(Outcome.DUPLICATE, "edge-existing"));
    when(edgeWriter.createOrMerge(
            eq("id-b"),
            eq(APP_ID),
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            any(),
            anySet()))
        .thenReturn(new WriteResult(Outcome.MERGED, "edge-existing"));

    service.suggestFromGithub(APP_ID, new SuggestConnectionsFromGithubRequest(null));

    assertThat(decisionSources.list(AiDecisionSourceService.TARGET_EDGE, "edge-existing")).isEmpty();
  }

  @Test
  void changedNodeRefKeepsTheNodeSourceFiles() {
    DataModelConfig config =
        new DataModelConfig(
            List.of(
                new DataModelField(
                    "domain",
                    "Domain",
                    "",
                    "",
                    List.of("PAY"),
                    true,
                    false,
                    DataModelDetection.AUTOMATIC_DETECTION,
                    DataModelTarget.NODE_REF,
                    false)));
    when(dataModelService.loadConfig()).thenReturn(config);
    when(dataModelAttributeResolver.validateNodeRefs(eq(config), any()))
        .thenReturn(
            new DataModelAttributeResolver.NodeRefValidationResult(
                true, Map.of("domain", List.of("PAY")), null, null));
    when(nodeRefLinkWriter.resolveActiveRefIdsByValue(eq("domain"), anySet()))
        .thenReturn(Map.of("PAY", "ref-pay"));
    when(nodeRefLinkReader.read(APP_ID)).thenReturn(Map.of());

    AiApplicationConnectionPayload payload = new AiApplicationConnectionPayload();
    payload.setConnections(new ArrayList<>());
    payload.setNodeRefs(Map.of("domain", "PAY"));
    payload.setNodeSourceFiles(List.of("docs/domain.md"));
    when(agent.discover(any(), anyString(), anyString(), anyString(), anyString(), anyString()))
        .thenReturn(
            new DiscoveryResult(payload, List.of("docs/domain.md"), List.of("docs/domain.md")));

    service.suggestFromGithub(APP_ID, new SuggestConnectionsFromGithubRequest(null));

    assertThat(decisionSources.list(AiDecisionSourceService.TARGET_APPLICATION, APP_ID))
        .singleElement()
        .satisfies(
            trace -> {
              assertThat(trace.fieldKey()).isEqualTo("domain");
              assertThat(trace.sourceFiles()).containsExactly("docs/domain.md");
            });
  }

  private void stubAgent(AiConnectionEntry... entries) {
    AiApplicationConnectionPayload payload = new AiApplicationConnectionPayload();
    payload.setConnections(new ArrayList<>(List.of(entries)));
    when(agent.discover(any(), anyString(), anyString(), anyString(), anyString(), anyString()))
        .thenReturn(new DiscoveryResult(payload, List.of("README.md")));
  }

  private static AiApplicationConnectionPayload payloadOf(AiConnectionEntry... entries) {
    AiApplicationConnectionPayload payload = new AiApplicationConnectionPayload();
    payload.setConnections(new ArrayList<>(List.of(entries)));
    return payload;
  }

  private Answer<AiDecisionSourceEntity> storeSource() {
    return invocation -> {
      AiDecisionSourceEntity entity = invocation.getArgument(0);
      storedSources.add(entity);
      return entity;
    };
  }

  private Answer<List<AiDecisionSourceEntity>> listSources() {
    return invocation -> {
      String targetType = invocation.getArgument(0);
      String targetId = invocation.getArgument(1);
      return storedSources.stream()
          .filter(row -> targetType.equals(row.getTargetType()) && targetId.equals(row.getTargetId()))
          .toList();
    };
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
    };
  }
}
