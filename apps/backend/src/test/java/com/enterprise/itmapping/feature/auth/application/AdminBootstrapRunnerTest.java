package com.enterprise.itmapping.feature.auth.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.auth.security.BootstrapAdminProperties;
import com.enterprise.itmapping.feature.workspace.domain.Workspaces;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.security.crypto.password.PasswordEncoder;

class AdminBootstrapRunnerTest {

  @Test
  void bootstrapAdminBelongsToTheDefaultWorkspace() {
    UserRepository userRepository = mock(UserRepository.class);
    PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    when(passwordEncoder.encode(any())).thenReturn("hash");
    AdminBootstrapRunner runner =
        new AdminBootstrapRunner(
            userRepository, passwordEncoder, new BootstrapAdminProperties("root", "password12"));

    runner.run(new DefaultApplicationArguments());

    ArgumentCaptor<UserEntity> saved = ArgumentCaptor.forClass(UserEntity.class);
    verify(userRepository).save(saved.capture());
    assertThat(saved.getValue().getWorkspaceId()).isEqualTo(Workspaces.DEFAULT_ID);
  }
}
