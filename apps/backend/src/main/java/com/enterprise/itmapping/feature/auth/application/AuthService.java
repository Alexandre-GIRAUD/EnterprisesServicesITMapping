package com.enterprise.itmapping.feature.auth.application;

import com.enterprise.itmapping.feature.auth.domain.UserStatus;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.auth.presentation.dto.LoginRequest;
import com.enterprise.itmapping.feature.auth.presentation.dto.LoginResponse;
import com.enterprise.itmapping.feature.auth.security.JwtService;
import com.enterprise.itmapping.feature.workspace.infrastructure.persistence.WorkspaceEntity;
import com.enterprise.itmapping.feature.workspace.infrastructure.persistence.WorkspaceRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

  private final UserRepository userRepository;
  private final PasswordEncoder passwordEncoder;
  private final JwtService jwtService;
  private final WorkspaceRepository workspaceRepository;

  public AuthService(
      UserRepository userRepository,
      PasswordEncoder passwordEncoder,
      JwtService jwtService,
      WorkspaceRepository workspaceRepository) {
    this.userRepository = userRepository;
    this.passwordEncoder = passwordEncoder;
    this.jwtService = jwtService;
    this.workspaceRepository = workspaceRepository;
  }

  public LoginResponse login(LoginRequest request) {
    String username = normalizeUsername(request.username());
    if (!StringUtils.hasText(username) || !StringUtils.hasText(request.password())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Identifiants invalides.");
    }
    UserEntity user =
        userRepository
            .findByUsernameIgnoreCase(username)
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Identifiants invalides."));
    if (!user.isEnabled()) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Identifiants invalides.");
    }
    if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Identifiants invalides.");
    }
    // Checked after the password, so the answer reveals nothing to someone without it.
    if (user.getStatus() == UserStatus.PENDING) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Email not verified.");
    }
    return openSession(user);
  }

  /** Signs {@code user} in: a JWT plus what the UI shows about the account. */
  public LoginResponse openSession(UserEntity user) {
    String role = user.getRole().name();
    String token = jwtService.createToken(user.getUsername(), role);
    String workspaceName =
        workspaceRepository.findById(user.getWorkspaceId()).map(WorkspaceEntity::getName).orElse("");
    return new LoginResponse(token, user.getUsername(), List.of(role), workspaceName);
  }

  public static String normalizeUsername(String raw) {
    if (raw == null) {
      return "";
    }
    return raw.trim().toLowerCase();
  }
}
