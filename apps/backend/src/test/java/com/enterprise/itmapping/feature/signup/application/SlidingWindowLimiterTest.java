package com.enterprise.itmapping.feature.signup.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class SlidingWindowLimiterTest {

  private static final Instant NOON = Instant.parse("2026-11-06T12:00:00Z");

  @Test
  void allowsUpToTheLimitPerKeyThenRefuses() {
    SlidingWindowLimiter limiter =
        new SlidingWindowLimiter(2, Duration.ofHours(1), Clock.fixed(NOON, ZoneOffset.UTC));

    assertThat(limiter.tryAcquire("a")).isTrue();
    assertThat(limiter.tryAcquire("a")).isTrue();
    assertThat(limiter.tryAcquire("a")).isFalse();
    assertThat(limiter.tryAcquire("b")).isTrue();
  }

  @Test
  void attemptsOlderThanTheWindowNoLongerCount() {
    MutableClock clock = new MutableClock(NOON);
    SlidingWindowLimiter limiter = new SlidingWindowLimiter(1, Duration.ofHours(1), clock);
    assertThat(limiter.tryAcquire("a")).isTrue();

    clock.now = NOON.plus(Duration.ofMinutes(61));

    assertThat(limiter.tryAcquire("a")).isTrue();
  }

  private static final class MutableClock extends Clock {
    private Instant now;

    MutableClock(Instant now) {
      this.now = now;
    }

    @Override
    public ZoneOffset getZone() {
      return ZoneOffset.UTC;
    }

    @Override
    public Clock withZone(ZoneId zone) {
      return this;
    }

    @Override
    public Instant instant() {
      return now;
    }
  }
}
