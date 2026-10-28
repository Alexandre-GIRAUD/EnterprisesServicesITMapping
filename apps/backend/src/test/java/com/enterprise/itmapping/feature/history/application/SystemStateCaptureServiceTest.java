package com.enterprise.itmapping.feature.history.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.history.infrastructure.persistence.SystemDailyStateEntity;
import com.enterprise.itmapping.feature.history.infrastructure.persistence.SystemDailyStateRepository;
import com.enterprise.itmapping.feature.history.infrastructure.persistence.SystemGraphState;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SystemStateCaptureServiceTest {

  private static final Instant NOON = Instant.parse("2026-03-01T12:00:00Z");

  @Mock SystemGraphState graphState;
  @Mock SystemDailyStateRepository repository;

  private SystemStateCaptureService service;

  @BeforeEach
  void setUp() {
    service =
        new SystemStateCaptureService(
            graphState, repository, Clock.fixed(NOON, ZoneOffset.UTC));
  }

  @Test
  void recaptureOfTheSameDayOverwritesTheExistingRow() {
    LocalDate day = LocalDate.of(2026, 3, 1);
    SystemDailyStateEntity existing =
        new SystemDailyStateEntity(day, new SystemState(List.of(), List.of(), List.of()), Instant.EPOCH);
    SystemState next = new SystemState(List.of(Map.of("id", "a")), List.of(), List.of());
    when(graphState.read()).thenReturn(next);
    when(repository.findById(day)).thenReturn(Optional.of(existing));
    when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

    service.captureFor(day);

    ArgumentCaptor<SystemDailyStateEntity> saved = ArgumentCaptor.forClass(SystemDailyStateEntity.class);
    verify(repository).save(saved.capture());
    assertThat(saved.getValue()).isSameAs(existing);
    assertThat(saved.getValue().getState()).isEqualTo(next);
    assertThat(saved.getValue().getCapturedAt()).isEqualTo(NOON);
  }
}
