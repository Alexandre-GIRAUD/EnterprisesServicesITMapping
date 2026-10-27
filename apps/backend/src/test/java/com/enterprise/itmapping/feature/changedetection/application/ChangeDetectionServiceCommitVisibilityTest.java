package com.enterprise.itmapping.feature.changedetection.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.applications.application.ApplicationConnectionSuggestionService;
import com.enterprise.itmapping.feature.applications.application.ApplicationNodeAttributePatchService;
import com.enterprise.itmapping.feature.applications.application.ModuleSuggestionService;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationGraphNodeProjection;
import com.enterprise.itmapping.feature.changedetection.domain.ChangeDetectionRunStatus;
import com.enterprise.itmapping.feature.changedetection.infrastructure.persistence.ChangeDetectionItemRepository;
import com.enterprise.itmapping.feature.changedetection.infrastructure.persistence.ChangeDetectionRunEntity;
import com.enterprise.itmapping.feature.changedetection.infrastructure.persistence.ChangeDetectionRunRepository;
import com.enterprise.itmapping.feature.datamodel.application.DataModelService;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.integrations.github.GitHubIntegrationProperties;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubCommitDiffService;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubCommitDiffService.DiffResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executor;
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * A push is saved and analyzed on another thread. That thread must not start until the insert is
 * committed, otherwise it observes an empty table.
 */
@SpringJUnitConfig(ChangeDetectionServiceCommitVisibilityTest.Config.class)
class ChangeDetectionServiceCommitVisibilityTest {

  private static final long WAIT_SECONDS = 3;

  @Autowired ChangeDetectionService changeDetectionService;
  @Autowired ChangeDetectionRunRepository runRepository;
  @Autowired LinkedApplicationResolver linkedApplicationResolver;
  @Autowired GitHubCommitDiffService commitDiffService;
  @Autowired DataModelService dataModelService;

  private final Map<UUID, ChangeDetectionRunEntity> committed = new ConcurrentHashMap<>();
  private final ThreadLocal<Map<UUID, ChangeDetectionRunEntity>> pending =
      ThreadLocal.withInitial(HashMap::new);
  private CountDownLatch analysisFinished;

  @BeforeEach
  void stubACommittedPush() throws Exception {
    committed.clear();
    pending.remove();
    analysisFinished = new CountDownLatch(1);
    ApplicationGraphNodeProjection application = mock(ApplicationGraphNodeProjection.class);
    when(application.getId()).thenReturn("app-1");
    when(linkedApplicationResolver.findByRepoFullName("acme/datahub"))
        .thenReturn(Optional.of(application));
    when(runRepository.findByRepoFullNameIgnoreCaseAndCommitSha(anyString(), anyString()))
        .thenReturn(Optional.empty());
    when(runRepository.save(any())).thenAnswer(invocation -> store(invocation.getArgument(0)));
    when(runRepository.findById(any()))
        .thenAnswer(
            invocation -> {
              UUID id = invocation.getArgument(0);
              ChangeDetectionRunEntity local = pending.get().get(id);
              if (local != null) {
                return Optional.of(local);
              }
              return Optional.ofNullable(committed.get(id));
            });
    when(commitDiffService.fetchCommitDiff(anyString(), anyString(), anyString()))
        .thenReturn(new DiffResult(List.of(), false));
    when(dataModelService.loadConfig()).thenReturn(new DataModelConfig(List.of()));
  }

  @Test
  void processingLoadsTheRunAfterThePushTransactionCommits() throws Exception {
    byte[] body =
        """
        {"ref":"refs/heads/main","repository":{"full_name":"acme/datahub"},"after":"abc123def456"}
        """
            .getBytes(StandardCharsets.UTF_8);

    List<UUID> accepted = changeDetectionService.ingestPushWebhook(body);

    assertThat(accepted).hasSize(1);
    assertThat(analysisFinished.await(WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();
    assertThat(committed.get(accepted.get(0)).getStatus()).isEqualTo(ChangeDetectionRunStatus.EMPTY);
  }

  private ChangeDetectionRunEntity store(ChangeDetectionRunEntity entity) throws Exception {
    if (entity.getId() == null) {
      Method prePersist = ChangeDetectionRunEntity.class.getDeclaredMethod("prePersist");
      prePersist.setAccessible(true);
      prePersist.invoke(entity);
    }
    pending.get().put(entity.getId(), entity);
    if (entity.getStatus() == ChangeDetectionRunStatus.EMPTY) {
      analysisFinished.countDown();
    }
    if (TransactionSynchronizationManager.isSynchronizationActive()) {
      TransactionSynchronizationManager.registerSynchronization(
          new TransactionSynchronization() {
            @Override
            public void afterCommit() {
              committed.putAll(pending.get());
            }

            @Override
            public void afterCompletion(int status) {
              pending.remove();
            }
          });
    } else {
      committed.put(entity.getId(), entity);
    }
    return entity;
  }

  @Configuration
  @EnableAsync
  @EnableTransactionManagement
  @Import(ChangeDetectionService.class)
  static class Config {

    /** Runs the analysis to completion before the caller continues, so an early start cannot win a race. */
    @Bean(name = "taskExecutor")
    Executor taskExecutor() {
      return command -> {
        FutureTask<Void> task = new FutureTask<>(command, null);
        Thread worker = new Thread(task, "change-detection-test");
        worker.start();
        try {
          task.get(WAIT_SECONDS, TimeUnit.SECONDS);
        } catch (Exception exception) {
          throw new IllegalStateException(exception);
        }
      };
    }

    @Bean
    PlatformTransactionManager transactionManager() {
      return new AbstractPlatformTransactionManager() {
        @Override
        protected Object doGetTransaction() {
          return new Object();
        }

        @Override
        protected void doBegin(Object transaction, TransactionDefinition definition) {}

        @Override
        protected void doCommit(DefaultTransactionStatus status) {}

        @Override
        protected void doRollback(DefaultTransactionStatus status) {}
      };
    }

    @Bean
    ChangeDetectionRunRepository runRepository() {
      return mock(ChangeDetectionRunRepository.class);
    }

    @Bean
    ChangeDetectionItemRepository itemRepository() {
      return mock(ChangeDetectionItemRepository.class);
    }

    @Bean
    LinkedApplicationResolver linkedApplicationResolver() {
      return mock(LinkedApplicationResolver.class);
    }

    @Bean
    GitHubCommitDiffService commitDiffService() {
      return mock(GitHubCommitDiffService.class);
    }

    @Bean
    DiffHeuristicAnalyzer heuristicAnalyzer() {
      return new DiffHeuristicAnalyzer();
    }

    @Bean
    DataModelService dataModelService() {
      return mock(DataModelService.class);
    }

    @Bean
    GitHubIntegrationProperties githubProperties() {
      return new GitHubIntegrationProperties(
          null, null, 0, null, "refs/heads/main", 0, 0, null, null, null, null);
    }

    @Bean
    ApplicationConnectionSuggestionService connectionSuggestionService() {
      return mock(ApplicationConnectionSuggestionService.class);
    }

    @Bean
    ModuleSuggestionService moduleSuggestionService() {
      return mock(ModuleSuggestionService.class);
    }

    @Bean
    ApplicationNodeAttributePatchService nodeAttributePatchService() {
      return mock(ApplicationNodeAttributePatchService.class);
    }

    @Bean
    ObjectMapper objectMapper() {
      return new ObjectMapper();
    }
  }
}
