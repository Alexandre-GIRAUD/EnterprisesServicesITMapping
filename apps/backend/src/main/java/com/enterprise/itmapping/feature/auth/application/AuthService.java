package com.enterprise.itmapping.feature.auth.application;

import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.auth.presentation.dto.LoginRequest;
import com.enterprise.itmapping.feature.auth.presentation.dto.LoginResponse;
import com.enterprise.itmapping.feature.auth.security.JwtService;
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

  public AuthService(
      UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
    this.userRepository = userRepository;
    this.passwordEncoder = passwordEncoder;
    this.jwtService = jwtService;
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
    String role = user.getRole().name();
    String token = jwtService.createToken(user.getUsername(), role);
    return new LoginResponse(token, user.getUsername(), java.util.List.of(role));
  }

  public static String normalizeUsername(String raw) {
    if (raw == null) {
      return "";
    }
    return raw.trim().toLowerCase();
  }
}
