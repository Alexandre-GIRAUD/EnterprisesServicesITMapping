package com.enterprise.itmapping.feature.signup.application;

import com.enterprise.itmapping.feature.signup.infrastructure.persistence.InvitationRepository;
import java.time.Clock;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Removes invitations a month after they expired; until then admins see them as expired. */
@Component
public class InvitationPurge {

  private static final Logger log = LoggerFactory.getLogger(InvitationPurge.class);
  private static final Duration KEPT_AFTER_EXPIRY = Duration.ofDays(30);

  private final InvitationRepository invitations;
  private final Clock clock;

  public InvitationPurge(InvitationRepository invitations, Clock clock) {
    this.invitations = invitations;
    this.clock = clock;
  }

  @Scheduled(cron = "${app.signup.purge-cron:0 30 3 * * *}")
  @Transactional
  public void purgeExpired() {
    int removed = invitations.deleteExpiredBefore(clock.instant().minus(KEPT_AFTER_EXPIRY));
    if (removed > 0) {
      log.info("Removed {} long-expired invitations.", removed);
    }
  }
}
