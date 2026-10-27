package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationGraphNodeProjection;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationResponse;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class ApplicationServiceHasModuleSubtreeTest {

  @Mock ApplicationRepository applicationRepository;
  @Mock Neo4jClient neo4jClient;
  @Mock ApplicationModuleSubtreeQuery moduleSubtreeQuery;
  @Mock ApplicationNodeAttributeReader nodeAttributeReader;
  @Mock ApplicationNodeRefLinkReader nodeRefLinkReader;

  @InjectMocks ApplicationService applicationService;

  ApplicationGraphNodeProjection projection;

  private static ApplicationGraphNodeProjection row(String id, String name, String description) {
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

  @BeforeEach
  void setUp() {
    lenient().when(nodeAttributeReader.read(any())).thenReturn(Map.of());
    lenient().when(nodeRefLinkReader.read(any())).thenReturn(Map.of());
    projection =
        new ApplicationGraphNodeProjection() {
          @Override
          public String getId() {
            return "app-1";
          }

          @Override
          public String getName() {
            return "o/r";
          }

          @Override
          public String getDescription() {
            return "";
          }
        };
  }

  @Test
  void findByIdIncludesHasModuleSubtreeFromQuery() {
    when(applicationRepository.findProjectionById(eq("app-1")))
        .thenReturn(Optional.of(projection));
    when(moduleSubtreeQuery.hasAnyModuleViaContains("app-1")).thenReturn(true);

    var res = applicationService.findById("app-1").orElseThrow();
    assertThat(res.hasModuleSubtree()).isTrue();
  }

  @Test
  void findByIdExposesNodeAttributes() {
    when(applicationRepository.findProjectionById(eq("app-1")))
        .thenReturn(Optional.of(projection));
    when(nodeAttributeReader.read("app-1")).thenReturn(Map.of("tier", (Object) "GOLD"));

    var res = applicationService.findById("app-1").orElseThrow();
    assertThat(res.nodeAttributes()).containsEntry("tier", "GOLD");
  }

  @Test
  void updateRejectsARepositoryAlreadyLinkedToAnotherApplication() {
    when(applicationRepository.findProjectionById("app-2")).thenReturn(Optional.of(row("app-2", "Checkout", "")));
    when(applicationRepository.findAllForGraph())
        .thenReturn(
            List.of(
                row("app-1", "Billing", "GitHub: https://github.com/acme/billing-api"),
                row("app-2", "Checkout", "")));

    assertThatThrownBy(
            () ->
                applicationService.update(
                    "app-2",
                    new ApplicationRequest(
                        "Checkout", "GitHub: https://github.com/acme/billing-api")))
        .isInstanceOf(ResponseStatusException.class);
  }

  @Test
  void findAllPassesBatchFlagsIntoResponse() {
    when(applicationRepository.findAllForGraph())
        .thenReturn(List.of(projection));
    when(moduleSubtreeQuery.hasAnyModuleViaContainsBatch(any()))
        .thenReturn(Map.of("app-1", true));

    List<ApplicationResponse> rows = applicationService.findAll();
    assertThat(rows).singleElement().satisfies(r -> assertThat(r.hasModuleSubtree()).isTrue());
  }
}
