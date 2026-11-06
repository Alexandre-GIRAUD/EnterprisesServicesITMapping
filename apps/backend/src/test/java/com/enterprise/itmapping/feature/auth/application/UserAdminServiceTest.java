package com.enterprise.itmapping.feature.auth.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.auth.domain.UserRole;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.auth.presentation.dto.CreateUserRequest;
import com.enterprise.itmapping.feature.auth.presentation.dto.UserSummaryResponse;
import com.enterprise.itmapping.feature.workspace.application.CurrentWorkspace;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;

class UserAdminServiceTest {

  private final UserRepository userRepository = mock(UserRepository.class);
  private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
  private final UserAdminService service = new UserAdminService(userRepository, passwordEncoder);
  private final UUID workspaceId = UUID.randomUUID();

  @Test
  void createdUsersJoinTheAdminWorkspace() {
    when(passwordEncoder.encode(any())).thenReturn("hash");

    CurrentWorkspace.runAs(
        workspaceId, () -> service.createUser(new CreateUserRequest("bob", "password12")));

    ArgumentCaptor<UserEntity> saved = ArgumentCaptor.forClass(UserEntity.class);
    verify(userRepository).save(saved.capture());
    assertThat(saved.getValue().getWorkspaceId()).isEqualTo(workspaceId);
  }

  @Test
  void listedUsersAreThoseOfTheAdminWorkspace() {
    UserEntity bob = new UserEntity();
    bob.setUsername("bob");
    bob.setRole(UserRole.USER);
    when(userRepository.findAllByWorkspaceIdOrderByUsernameAsc(workspaceId)).thenReturn(List.of(bob));
    AtomicReference<List<UserSummaryResponse>> listed = new AtomicReference<>();

    CurrentWorkspace.runAs(workspaceId, () -> listed.set(service.listUsers()));

    assertThat(listed.get()).extracting(UserSummaryResponse::username).containsExactly("bob");
  }
}
