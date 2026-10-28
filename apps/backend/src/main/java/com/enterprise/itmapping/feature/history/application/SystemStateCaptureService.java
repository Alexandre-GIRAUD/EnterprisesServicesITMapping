package com.enterprise.itmapping.feature.history.application;

import com.enterprise.itmapping.feature.history.infrastructure.persistence.SystemDailyStateEntity;
import com.enterprise.itmapping.feature.history.infrastructure.persistence.SystemDailyStateRepository;
import com.enterprise.itmapping.feature.history.infrastructure.persistence.SystemGraphState;
import java.time.Clock;
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

  public SystemStateCaptureService(
      SystemGraphState graphState, SystemDailyStateRepository repository, Clock clock) {
    this.graphState = graphState;
    this.repository = repository;
    this.clock = clock;
  }

  // ponytail: changes made between the last run of a day and midnight are credited to the next
  // day; lower app.history.capture-interval to narrow that window.
  @Scheduled(fixedDelayString = "${app.history.capture-interval:PT5M}")
  public void captureToday() {
    captureFor(LocalDate.now(clock));
  }

  @Transactional
  public void captureFor(LocalDate day) {
    repository.save(new SystemDailyStateEntity(day, graphState.read(), clock.instant()));
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
