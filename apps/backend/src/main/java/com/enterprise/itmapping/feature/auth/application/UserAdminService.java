package com.enterprise.itmapping.feature.auth.application;

import com.enterprise.itmapping.feature.auth.domain.UserRole;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.auth.presentation.dto.CreateUserRequest;
import com.enterprise.itmapping.feature.auth.presentation.dto.UserSummaryResponse;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
public class UserAdminService {

  private final UserRepository userRepository;
  private final PasswordEncoder passwordEncoder;

  public UserAdminService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
    this.userRepository = userRepository;
    this.passwordEncoder = passwordEncoder;
  }

  @Transactional
  public UserSummaryResponse createUser(CreateUserRequest request) {
    String username = AuthService.normalizeUsername(request.username());
    if (!StringUtils.hasText(username)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nom d'utilisateur requis.");
    }
    if (userRepository.existsByUsernameIgnoreCase(username)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Ce nom d'utilisateur existe deja.");
    }
    UserEntity u = new UserEntity();
    u.setUsername(username);
    u.setPasswordHash(passwordEncoder.encode(request.password()));
    u.setRole(UserRole.USER);
    u.setEnabled(true);
    userRepository.save(u);
    return UserSummaryResponse.from(u);
  }

  @Transactional(readOnly = true)
  public List<UserSummaryResponse> listUsers() {
    return userRepository.findAllByOrderByUsernameAsc().stream().map(UserSummaryResponse::from).toList();
  }
}
