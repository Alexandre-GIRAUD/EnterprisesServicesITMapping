package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;

import com.enterprise.itmapping.feature.applications.application.ModuleDiscoveryAgent.DiscoveryResult;
import com.enterprise.itmapping.feature.applications.application.dto.AiModuleSuggestionPayload;
import com.enterprise.itmapping.feature.applications.application.dto.AiModuleSuggestionPayload.AiModuleEntry;
import com.enterprise.itmapping.feature.applications.application.dto.AiModuleSuggestionPayload.AiRelationshipEntry;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.AiDecisionSourceEntity;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.AiDecisionSourceRepository;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationGraphNodeProjection;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestModulesFromGithubRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.SuggestModulesFromGithubResponse;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubRepoCloneService;
import com.enterprise.itmapping.feature.integrations.llm.ModuleDiscoveryProperties;
import com.enterprise.itmapping.feature.applications.application.ApplicationDetectionDocumentService.StoredDocument;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.stubbing.Answer;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class ModuleSuggestionServiceTest {

  private static final String APP_ID = "app-billing";

  @Mock ApplicationRepository applicationRepository;
  @Mock GitHubRepoCloneService cloneService;
  @Mock ModuleDiscoveryAgent agent;
  @Mock ObjectProvider<ModuleSuggestionService> self;
  @Mock ApplicationModuleSubtreeQuery moduleSubtreeQuery;
  @Mock AiDecisionSourceRepository decisionSourceRepository;
  @Mock ApplicationDetectionDocumentService documentService;
  @Mock ApplicationModuleLifecycle moduleLifecycle;

  private final List<AiDecisionSourceEntity> storedSources = new ArrayList<>();
  private AiDecisionSourceService decisionSources;
  private ModuleSuggestionService service;

  @BeforeEach
  void setUp() {
    decisionSources = new AiDecisionSourceService(decisionSourceRepository);
    lenient()
        .when(decisionSourceRepository.save(any(AiDecisionSourceEntity.class)))
        .thenAnswer(storeSource());
    lenient()
        .when(
            decisionSourceRepository.findByTargetTypeAndTargetIdOrderByCreatedAtAsc(
                anyString(), anyString()))
        .thenAnswer(listSources());
    Neo4jClient neo4jClient = mock(Neo4jClient.class, RETURNS_DEEP_STUBS);
    service =
        new ModuleSuggestionService(
            applicationRepository,
            cloneService,
            agent,
            new ModuleDiscoveryProperties(25, 50, 12000, 500, 120),
            neo4jClient,
            self,
            moduleSubtreeQuery,
            decisionSources,
            documentService,
            moduleLifecycle);
    when(self.getObject()).thenReturn(service);
    lenient()
        .when(applicationRepository.findProjectionById(APP_ID))
        .thenReturn(Optional.of(projection()));
    lenient().when(cloneService.clone(anyString(), anyString(), anyInt())).thenReturn(Path.of("dummy"));
  }

  @Test
  void createdModulesAndContainsEdgesKeepGroundedSourceFiles() {
    when(agent.discover(any(), anyString(), anyString()))
        .thenReturn(
            new DiscoveryResult(
                payload(),
                List.of("pom.xml", "src/Catalog.java"),
                List.of("pom.xml", "src/Catalog.java")));

    SuggestModulesFromGithubResponse response =
        service.suggestFromGithub(APP_ID, new SuggestModulesFromGithubRequest(null));

    String billingId = response.created().get(0).neo4jModuleId();
    String catalogId = response.created().get(1).neo4jModuleId();
    verify(moduleLifecycle).recordCreated(APP_ID, billingId, "Billing");
    verify(moduleLifecycle).recordCreated(APP_ID, catalogId, "Catalog");
    assertThat(decisionSources.list(AiDecisionSourceService.TARGET_MODULE, billingId))
        .singleElement()
        .satisfies(
            trace -> {
              assertThat(trace.decisionKind()).isEqualTo(AiDecisionSourceService.KIND_NODE);
              assertThat(trace.sourceFiles()).containsExactly("pom.xml");
              assertThat(trace.repositoryName()).isEqualTo("acme/billing");
            });
    assertThat(decisionSources.list(AiDecisionSourceService.TARGET_MODULE, catalogId))
        .singleElement()
        .satisfies(trace -> assertThat(trace.sourceFiles()).containsExactly("src/Catalog.java"));
    assertThat(
            decisionSources.list(
                AiDecisionSourceService.TARGET_EDGE,
                AiDecisionSourceService.containsTargetId(APP_ID, billingId)))
        .singleElement()
        .satisfies(trace -> assertThat(trace.sourceFiles()).containsExactly("pom.xml"));
    assertThat(
            decisionSources.list(
                AiDecisionSourceService.TARGET_EDGE,
                AiDecisionSourceService.containsTargetId(billingId, catalogId)))
        .singleElement()
        .satisfies(
            trace -> {
              assertThat(trace.decisionKind()).isEqualTo(AiDecisionSourceService.KIND_EDGE);
              assertThat(trace.sourceFiles()).containsExactly("src/Catalog.java");
            });
  }

  @Test
  void documentRunWritesModulesCitedInTheNote() {
    when(applicationRepository.findProjectionById(APP_ID)).thenReturn(Optional.of(named("Billing")));
    when(documentService.require(APP_ID))
        .thenReturn(
            new StoredDocument(
                "Vendor note",
                "Billing owns invoices. Catalog sits inside billing.",
                Instant.parse("2026-10-15T00:00:00Z")));
    when(agent.discoverFromDocument(anyString(), anyString(), anyString()))
        .thenReturn(new DiscoveryResult(documentPayload(), List.of("Vendor note")));

    SuggestModulesFromGithubResponse response = service.suggestFromDocument(APP_ID);

    assertThat(response.created()).hasSize(2);
    String billingId = response.created().get(0).neo4jModuleId();
    assertThat(decisionSources.list(AiDecisionSourceService.TARGET_MODULE, billingId))
        .singleElement()
        .satisfies(
            trace -> {
              assertThat(trace.repositoryName()).isEqualTo("Vendor note");
              assertThat(trace.sourceFiles()).containsExactly("Billing owns invoices.");
            });
    verify(cloneService, never()).clone(anyString(), anyString(), anyInt());
  }

  @Test
  void replaceExistingRescansWhenModulesAreAlreadyPresent() {
    when(moduleSubtreeQuery.hasAnyModuleViaContains(APP_ID)).thenReturn(true);
    when(agent.discover(any(), anyString(), anyString()))
        .thenReturn(new DiscoveryResult(payload(), List.of("pom.xml"), List.of("pom.xml")));

    SuggestModulesFromGithubResponse response =
        service.suggestFromGithub(APP_ID, new SuggestModulesFromGithubRequest(null, true));

    assertThat(response.created()).isNotEmpty();
    verify(moduleLifecycle).removeAll(APP_ID);
    verify(agent).discover(any(), anyString(), anyString());
  }

  @Test
  void documentRunSkipsAModuleWhoseQuoteIsMissing() {
    when(applicationRepository.findProjectionById(APP_ID)).thenReturn(Optional.of(named("Billing")));
    when(documentService.require(APP_ID))
        .thenReturn(new StoredDocument("Vendor note", "Billing owns invoices.", Instant.now()));
    AiModuleEntry billing = new AiModuleEntry();
    billing.setId("billing");
    billing.setBusinessName("Billing");
    billing.setSourceFiles(List.of("not in the note"));
    AiModuleSuggestionPayload payload = new AiModuleSuggestionPayload();
    payload.setModules(List.of(billing));
    when(agent.discoverFromDocument(anyString(), anyString(), anyString()))
        .thenReturn(new DiscoveryResult(payload, List.of("Vendor note")));

    SuggestModulesFromGithubResponse response = service.suggestFromDocument(APP_ID);

    assertThat(response.created()).isEmpty();
    assertThat(response.skipped()).extracting(SuggestModulesFromGithubResponse.SkippedItem::reason)
        .contains("evidence_absente");
  }

  @Test
  void documentRunRefusesWhenModulesAlreadyExist() {
    when(applicationRepository.findProjectionById(APP_ID)).thenReturn(Optional.of(named("Billing")));
    when(moduleSubtreeQuery.hasAnyModuleViaContains(APP_ID)).thenReturn(true);

    assertThatThrownBy(() -> service.suggestFromDocument(APP_ID))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(HttpStatus.CONFLICT);
    verify(agent, never()).discoverFromDocument(anyString(), anyString(), anyString());
  }

  private static AiModuleSuggestionPayload documentPayload() {
    AiModuleEntry billing = new AiModuleEntry();
    billing.setId("billing");
    billing.setBusinessName("Billing");
    billing.setSourceFiles(List.of("Billing owns invoices."));
    AiModuleEntry catalog = new AiModuleEntry();
    catalog.setId("catalog");
    catalog.setBusinessName("Catalog");
    catalog.setSourceFiles(List.of("Catalog sits inside billing."));
    AiRelationshipEntry relationship = new AiRelationshipEntry();
    relationship.setFromModuleId("billing");
    relationship.setToModuleId("catalog");
    relationship.setRelationshipKind("structural_contains");
    relationship.setSourceFiles(List.of("Catalog sits inside billing."));
    AiModuleSuggestionPayload payload = new AiModuleSuggestionPayload();
    payload.setModules(List.of(billing, catalog));
    payload.setRelationships(List.of(relationship));
    return payload;
  }

  private static ApplicationGraphNodeProjection named(String name) {
    return new ApplicationGraphNodeProjection() {
      @Override
      public String getId() {
        return APP_ID;
      }

      @Override
      public String getName() {
        return name;
      }

      @Override
      public String getDescription() {
        return null;
      }
    };
  }

  private static AiModuleSuggestionPayload payload() {
    AiModuleEntry billing = new AiModuleEntry();
    billing.setId("billing");
    billing.setBusinessName("Billing");
    billing.setSourceFiles(List.of("pom.xml", "src/Ghost.java"));
    AiModuleEntry catalog = new AiModuleEntry();
    catalog.setId("catalog");
    catalog.setBusinessName("Catalog");
    catalog.setSourceFiles(List.of("src/Catalog.java"));
    AiRelationshipEntry relationship = new AiRelationshipEntry();
    relationship.setFromModuleId("billing");
    relationship.setToModuleId("catalog");
    relationship.setRelationshipKind("structural_contains");
    relationship.setSourceFiles(List.of("src/Catalog.java"));
    AiModuleSuggestionPayload payload = new AiModuleSuggestionPayload();
    payload.setModules(List.of(billing, catalog));
    payload.setRelationships(List.of(relationship));
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

  private static ApplicationGraphNodeProjection projection() {
    return new ApplicationGraphNodeProjection() {
      @Override
      public String getId() {
        return APP_ID;
      }

      @Override
      public String getName() {
        return "acme/billing";
      }

      @Override
      public String getDescription() {
        return null;
      }
    };
  }
}
