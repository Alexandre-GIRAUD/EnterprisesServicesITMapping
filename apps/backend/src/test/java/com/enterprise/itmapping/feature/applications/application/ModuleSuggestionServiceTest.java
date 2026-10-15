package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
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
import java.nio.file.Path;
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

@ExtendWith(MockitoExtension.class)
class ModuleSuggestionServiceTest {

  private static final String APP_ID = "app-billing";

  @Mock ApplicationRepository applicationRepository;
  @Mock GitHubRepoCloneService cloneService;
  @Mock ModuleDiscoveryAgent agent;
  @Mock ObjectProvider<ModuleSuggestionService> self;
  @Mock ApplicationModuleSubtreeQuery moduleSubtreeQuery;
  @Mock AiDecisionSourceRepository decisionSourceRepository;

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
            decisionSources);
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
