package com.enterprise.itmapping.feature.auth.application;

import com.enterprise.itmapping.feature.auth.domain.UserRole;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.auth.security.BootstrapAdminProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Creates the first admin user when the {@code users} table is empty and bootstrap properties are
 * set. Prefer rotating credentials after first login in production.
 */
@Component
@Order(Integer.MAX_VALUE)
public class AdminBootstrapRunner implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(AdminBootstrapRunner.class);

  private final UserRepository userRepository;
  private final PasswordEncoder passwordEncoder;
  private final BootstrapAdminProperties bootstrapAdminProperties;

  public AdminBootstrapRunner(
      UserRepository userRepository,
      PasswordEncoder passwordEncoder,
      BootstrapAdminProperties bootstrapAdminProperties) {
    this.userRepository = userRepository;
    this.passwordEncoder = passwordEncoder;
    this.bootstrapAdminProperties = bootstrapAdminProperties;
  }

  @Override
  public void run(ApplicationArguments args) {
    if (userRepository.count() > 0) {
      return;
    }
    String u =
        bootstrapAdminProperties.username() != null
            ? bootstrapAdminProperties.username().trim()
            : "";
    String p = bootstrapAdminProperties.password() != null ? bootstrapAdminProperties.password() : "";
    if (!StringUtils.hasText(u) || !StringUtils.hasText(p)) {
      log.warn(
          "Aucun utilisateur en base. Definissez ADMIN_BOOTSTRAP_USERNAME et ADMIN_BOOTSTRAP_PASSWORD "
              + "(app.security.bootstrap-admin) pour creer le premier administrateur au demarrage.");
      return;
    }
    String normalized = AuthService.normalizeUsername(u);
    if (userRepository.existsByUsernameIgnoreCase(normalized)) {
      return;
    }
    UserEntity admin = new UserEntity();
    admin.setUsername(normalized);
    admin.setPasswordHash(passwordEncoder.encode(p));
    admin.setRole(UserRole.ADMIN);
    admin.setEnabled(true);
    userRepository.save(admin);
    log.info("Compte administrateur initial cree pour l'utilisateur '{}'.", normalized);
  }
}
