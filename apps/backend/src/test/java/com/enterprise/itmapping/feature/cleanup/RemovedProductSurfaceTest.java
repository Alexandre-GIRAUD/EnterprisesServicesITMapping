package com.enterprise.itmapping.feature.cleanup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.changedetection.domain.ChangeDetectionItemKind;
import com.enterprise.itmapping.feature.integrations.github.GitHubIntegrationProperties;
import java.util.Arrays;
import org.junit.jupiter.api.Test;

/**
 * Throwaway absence checks for the dead-code cleanup. Delete this class in the test audit once the
 * removals have landed; it does not lock behaviour that should stay.
 */
class RemovedProductSurfaceTest {

  @Test
  void customHealthControllerIsAbsent() {
    assertThatThrownBy(
            () -> Class.forName("com.enterprise.itmapping.feature.graph.presentation.HealthController"))
        .isInstanceOf(ClassNotFoundException.class);
  }

  @Test
  void gitHubOAuthClientIsAbsent() {
    assertThatThrownBy(
            () ->
                Class.forName(
                    "com.enterprise.itmapping.feature.integrations.github.application.GitHubOAuthClient"))
        .isInstanceOf(ClassNotFoundException.class);
  }

  @Test
  void gitHubOAuthSettingsAreAbsent() {
    assertThatThrownBy(() -> GitHubIntegrationProperties.class.getMethod("clientId"))
        .isInstanceOf(NoSuchMethodException.class);
    assertThatThrownBy(() -> UserEntity.class.getMethod("getGithubOauthState"))
        .isInstanceOf(NoSuchMethodException.class);
  }

  @Test
  void sampleGraphSeederIsAbsent() {
    assertThatThrownBy(() -> Class.forName("com.enterprise.itmapping.config.SampleGraphDataSeeder"))
        .isInstanceOf(ClassNotFoundException.class);
  }

  @Test
  void edgeAttributeChangeKindIsAbsent() {
    assertThat(Arrays.stream(ChangeDetectionItemKind.values()).map(Enum::name))
        .doesNotContain("EDGE_ATTRIBUTE");
  }

  @Test
  void duplicateGraphLookupIsAbsent() {
    assertThatThrownBy(() -> ApplicationRepository.class.getMethod("findByIdForGraph", String.class))
        .isInstanceOf(NoSuchMethodException.class);
  }
}
