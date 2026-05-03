package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationGraphNodeProjection;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.applications.presentation.dto.ApplicationResponse;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.neo4j.core.Neo4jClient;

@ExtendWith(MockitoExtension.class)
class ApplicationServiceHasModuleSubtreeTest {

  @Mock ApplicationRepository applicationRepository;
  @Mock Neo4jClient neo4jClient;
  @Mock ApplicationModuleSubtreeQuery moduleSubtreeQuery;

  @InjectMocks ApplicationService applicationService;

  ApplicationGraphNodeProjection projection;

  @BeforeEach
  void setUp() {
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

          @Override
          public Instant getValidFrom() {
            return Instant.parse("2025-01-01T00:00:00Z");
          }

          @Override
          public Instant getValidTo() {
            return null;
          }
        };
  }

  @Test
  void findByIdIncludesHasModuleSubtreeFromQuery() {
    when(applicationRepository.findByIdValidAtForGraph(eq("app-1"), any()))
        .thenReturn(Optional.of(projection));
    when(moduleSubtreeQuery.hasAnyModuleViaContains("app-1")).thenReturn(true);

    var res = applicationService.findById("app-1", null).orElseThrow();
    assertThat(res.hasModuleSubtree()).isTrue();
  }

  @Test
  void findAllPassesBatchFlagsIntoResponse() {
    when(applicationRepository.findAllValidAtForGraph(any()))
        .thenReturn(List.of(projection));
    when(moduleSubtreeQuery.hasAnyModuleViaContainsBatch(any()))
        .thenReturn(java.util.Map.of("app-1", true));

    List<ApplicationResponse> rows = applicationService.findAll(null);
    assertThat(rows).singleElement().satisfies(r -> assertThat(r.hasModuleSubtree()).isTrue());
  }
}
