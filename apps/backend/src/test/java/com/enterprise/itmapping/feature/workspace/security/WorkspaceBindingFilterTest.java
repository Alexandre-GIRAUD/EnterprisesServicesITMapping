package com.enterprise.itmapping.feature.workspace.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.workspace.application.CurrentWorkspace;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class WorkspaceBindingFilterTest {

  private final UserRepository userRepository = mock(UserRepository.class);
  private final WorkspaceBindingFilter filter = new WorkspaceBindingFilter(userRepository);

  @AfterEach
  void clearSecurityContext() {
    SecurityContextHolder.clearContext();
  }

  @Test
  void bindsTheSignedInUserWorkspaceForTheRequestOnly() throws Exception {
    UUID workspaceId = UUID.randomUUID();
    UserEntity alice = new UserEntity();
    alice.setUsername("alice");
    alice.setWorkspaceId(workspaceId);
    when(userRepository.findBySessionSubject("alice")).thenReturn(Optional.of(alice));
    SecurityContextHolder.getContext()
        .setAuthentication(new UsernamePasswordAuthenticationToken("alice", null, List.of()));
    AtomicReference<Optional<UUID>> seenInChain = new AtomicReference<>();

    filter.doFilter(
        new MockHttpServletRequest(),
        new MockHttpServletResponse(),
        (req, res) -> seenInChain.set(CurrentWorkspace.find()));

    assertThat(seenInChain.get()).contains(workspaceId);
    assertThat(CurrentWorkspace.find()).isEmpty();
  }

  @Test
  void leavesAnonymousRequestsWithoutWorkspace() throws Exception {
    AtomicReference<Optional<UUID>> seenInChain = new AtomicReference<>();

    filter.doFilter(
        new MockHttpServletRequest(),
        new MockHttpServletResponse(),
        (req, res) -> seenInChain.set(CurrentWorkspace.find()));

    assertThat(seenInChain.get()).isEmpty();
  }
}
