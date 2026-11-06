package com.enterprise.itmapping.feature.workspace.security;

import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.workspace.application.CurrentWorkspace;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Binds the signed-in user's workspace for the rest of the request. The workspace comes from the
 * user row, never from anything the client sends.
 */
public class WorkspaceBindingFilter extends OncePerRequestFilter {

  private final UserRepository userRepository;

  public WorkspaceBindingFilter(UserRepository userRepository) {
    this.userRepository = userRepository;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    Optional<UUID> workspaceId = findSignedInUserWorkspace();
    if (workspaceId.isEmpty()) {
      filterChain.doFilter(request, response);
      return;
    }
    try (CurrentWorkspace.Binding ignored = CurrentWorkspace.bind(workspaceId.get())) {
      filterChain.doFilter(request, response);
    }
  }

  private Optional<UUID> findSignedInUserWorkspace() {
    var authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null || !StringUtils.hasText(authentication.getName())) {
      return Optional.empty();
    }
    return userRepository
        .findByUsernameIgnoreCase(authentication.getName())
        .map(UserEntity::getWorkspaceId);
  }
}
