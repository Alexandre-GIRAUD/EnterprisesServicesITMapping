package com.enterprise.itmapping.feature.functionaldoc.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationGraphNodeProjection;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.functionaldoc.domain.FunctionalDocStatus;
import com.enterprise.itmapping.feature.functionaldoc.infrastructure.persistence.ApplicationFunctionalDocEntity;
import com.enterprise.itmapping.feature.functionaldoc.infrastructure.persistence.ApplicationFunctionalDocRepository;
import com.enterprise.itmapping.feature.functionaldoc.presentation.dto.FunctionalDocumentationResponse;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubRepoCloneService;
import com.enterprise.itmapping.feature.integrations.llm.FunctionalDocumentationProperties;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class FunctionalDocumentationServiceTest {

  @Mock ApplicationRepository applicationRepository;
  @Mock ApplicationFunctionalDocRepository docRepository;
  @Mock GitHubRepoCloneService cloneService;
  @Mock FunctionalDocumentationAgent agent;
  @Mock ObjectProvider<FunctionalDocumentationService> self;

  FunctionalDocumentationProperties properties =
      new FunctionalDocumentationProperties(25, 50, 12000, 500, 120, "en", false);

  FunctionalDocumentationService service;

  @BeforeEach
  void setUp() {
    service =
        spy(
            new FunctionalDocumentationService(
                applicationRepository, docRepository, cloneService, agent, properties, self));
    lenient().when(self.getObject()).thenReturn(service);
  }

  @Test
  void getReturnsMissingWhenNoRow() {
    when(applicationRepository.findProjectionById("app-1"))
        .thenReturn(Optional.of(projection("app-1", "org/repo", null)));
    when(docRepository.findByApplicationId("app-1")).thenReturn(Optional.empty());

    FunctionalDocumentationResponse response = service.get("app-1");

    assertThat(response.status()).isEqualTo(FunctionalDocStatus.MISSING);
    assertThat(response.payload()).isNull();
  }

  @Test
  void startGeneratePersistsPendingAndSchedulesAsync() {
    when(applicationRepository.findProjectionById("app-1"))
        .thenReturn(Optional.of(projection("app-1", "acme/payments", null)));
    when(docRepository.findByApplicationId("app-1")).thenReturn(Optional.empty());
    when(docRepository.save(any(ApplicationFunctionalDocEntity.class)))
        .thenAnswer(inv -> inv.getArgument(0));
    doNothing().when(service).generateAsync(anyString());

    FunctionalDocumentationResponse response = service.startGenerate("app-1");

    ArgumentCaptor<ApplicationFunctionalDocEntity> captor =
        ArgumentCaptor.forClass(ApplicationFunctionalDocEntity.class);
    verify(docRepository).save(captor.capture());
    assertThat(captor.getValue().getStatus()).isEqualTo(FunctionalDocStatus.PENDING);
    assertThat(captor.getValue().getSourceRepo()).isEqualTo("acme/payments");
    assertThat(response.status()).isEqualTo(FunctionalDocStatus.PENDING);
    verify(service).markPending(eq("app-1"));
    verify(service).generateAsync(eq("app-1"));
  }

  @Test
  void startGenerateRejectsWhenPending() {
    when(applicationRepository.findProjectionById("app-1"))
        .thenReturn(Optional.of(projection("app-1", "org/repo", null)));
    ApplicationFunctionalDocEntity pending = new ApplicationFunctionalDocEntity();
    pending.setApplicationId("app-1");
    pending.setStatus(FunctionalDocStatus.PENDING);
    try {
      var id = ApplicationFunctionalDocEntity.class.getDeclaredField("id");
      id.setAccessible(true);
      id.set(pending, UUID.randomUUID());
    } catch (ReflectiveOperationException e) {
      throw new RuntimeException(e);
    }
    when(docRepository.findByApplicationId("app-1")).thenReturn(Optional.of(pending));

    assertThatThrownBy(() -> service.markPending("app-1"))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(HttpStatus.CONFLICT);
    verify(cloneService, never()).clone(anyString(), anyString(), anyInt());
  }

  @Test
  void startGenerateRejectsNonGithubApp() {
    when(applicationRepository.findProjectionById("app-1"))
        .thenReturn(Optional.of(projection("app-1", "Legacy CRM", "internal system")));

    assertThatThrownBy(() -> service.markPending("app-1"))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(HttpStatus.BAD_REQUEST);
  }

  private static ApplicationGraphNodeProjection projection(
      String id, String name, String description) {
    return new ApplicationGraphNodeProjection() {
      @Override
      public String getId() {
        return id;
      }

      @Override
      public String getName() {
        return name;
      }

      @Override
      public String getDescription() {
        return description;
      }
    };
  }
}
