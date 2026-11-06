package com.enterprise.itmapping.feature.signup.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * At most {@code maxAttempts} per key within a sliding {@code window}. In memory: limits reset when
 * the backend restarts, which is acceptable for abuse throttling on a single instance.
 */
public class SlidingWindowLimiter {

  private final int maxAttempts;
  private final Duration window;
  private final Clock clock;
  private final Map<String, Deque<Instant>> attemptsByKey = new ConcurrentHashMap<>();

  public SlidingWindowLimiter(int maxAttempts, Duration window, Clock clock) {
    this.maxAttempts = maxAttempts;
    this.window = window;
    this.clock = clock;
  }

  public static SlidingWindowLimiter perHour(int maxAttempts, Clock clock) {
    return new SlidingWindowLimiter(maxAttempts, Duration.ofHours(1), clock);
  }

  /** Records an attempt for {@code key} and says whether it is within the limit. */
  public boolean tryAcquire(String key) {
    Instant now = clock.instant();
    Instant windowStart = now.minus(window);
    boolean[] isAllowed = {false};
    attemptsByKey.compute(
        key,
        (ignored, attempts) -> {
          Deque<Instant> recent = attempts != null ? attempts : new ArrayDeque<>();
          while (!recent.isEmpty() && !recent.peekFirst().isAfter(windowStart)) {
            recent.pollFirst();
          }
          isAllowed[0] = recent.size() < maxAttempts;
          if (isAllowed[0]) {
            recent.addLast(now);
          }
          return recent;
        });
    return isAllowed[0];
  }
}
