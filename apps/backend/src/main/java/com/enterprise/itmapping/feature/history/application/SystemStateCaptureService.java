package com.enterprise.itmapping.feature.history.application;

import com.enterprise.itmapping.feature.history.infrastructure.persistence.SystemDailyStateEntity;
import com.enterprise.itmapping.feature.history.infrastructure.persistence.SystemDailyStateRepository;
import com.enterprise.itmapping.feature.history.infrastructure.persistence.SystemGraphState;
import com.enterprise.itmapping.feature.workspace.application.EveryWorkspace;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Keeps one copy of the Production graph per day. Today's row is overwritten on every run, so a past
 * day holds its last capture.
 */
@Service
public class SystemStateCaptureService {

  private final SystemGraphState graphState;
  private final SystemDailyStateRepository repository;
  private final Clock clock;
  private final EveryWorkspace everyWorkspace;

  public SystemStateCaptureService(
      SystemGraphState graphState,
      SystemDailyStateRepository repository,
      Clock clock,
      EveryWorkspace everyWorkspace) {
    this.graphState = graphState;
    this.repository = repository;
    this.clock = clock;
    this.everyWorkspace = everyWorkspace;
  }

  // ponytail: changes made between the last run of a day and midnight are credited to the next
  // day; lower app.history.capture-interval to narrow that window.
  @Scheduled(fixedDelayString = "${app.history.capture-interval:PT5M}")
  public void captureToday() {
    LocalDate today = LocalDate.now(clock);
    everyWorkspace.run(() -> captureFor(today));
  }

  @Transactional
  public void captureFor(LocalDate day) {
    SystemState state = graphState.read();
    Instant capturedAt = clock.instant();
    SystemDailyStateEntity row =
        repository.findByDay(day).orElseGet(() -> new SystemDailyStateEntity(day, state, capturedAt));
    row.overwrite(state, capturedAt);
    repository.save(row);
  }

  @Transactional(readOnly = true)
  public Optional<LocalDate> firstDay() {
    return repository.findFirstByOrderByDayAsc().map(SystemDailyStateEntity::getDay);
  }

  @Transactional(readOnly = true)
  public Optional<SystemState> stateOn(LocalDate day) {
    return repository
        .findFirstByDayLessThanEqualOrderByDayDesc(day)
        .map(SystemDailyStateEntity::getState);
  }
}
