package com.enterprise.itmapping.feature.signup.application;

import com.enterprise.itmapping.feature.auth.domain.UserStatus;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.workspace.infrastructure.persistence.WorkspaceRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Removes accounts never confirmed within a week, with the workspace they created, so the email
 * can sign up again. A pending account cannot sign in, so its workspace holds no data.
 */
@Component
public class PendingAccountPurge {

  private static final Logger log = LoggerFactory.getLogger(PendingAccountPurge.class);
  private static final Duration CONFIRMATION_DEADLINE = Duration.ofDays(7);

  private final UserRepository userRepository;
  private final WorkspaceRepository workspaceRepository;
  private final Clock clock;

  public PendingAccountPurge(
      UserRepository userRepository, WorkspaceRepository workspaceRepository, Clock clock) {
    this.userRepository = userRepository;
    this.workspaceRepository = workspaceRepository;
    this.clock = clock;
  }

  @Scheduled(cron = "${app.signup.purge-cron:0 30 3 * * *}")
  @Transactional
  public void purgeExpired() {
    Instant deadline = clock.instant().minus(CONFIRMATION_DEADLINE);
    for (UserEntity user :
        userRepository.findAllByStatusAndCreatedAtBefore(UserStatus.PENDING, deadline)) {
      userRepository.delete(user);
      userRepository.flush();
      workspaceRepository.deleteById(user.getWorkspaceId());
      log.info("Removed unconfirmed account {} and its workspace.", user.getUsername());
    }
  }
}
