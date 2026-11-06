package com.enterprise.itmapping.feature.history.infrastructure.persistence;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SystemDailyStateRepository extends JpaRepository<SystemDailyStateEntity, UUID> {

  /** Latest capture on or before {@code day}: days without a capture inherit the previous one. */
  Optional<SystemDailyStateEntity> findFirstByDayLessThanEqualOrderByDayDesc(LocalDate day);

  Optional<SystemDailyStateEntity> findFirstByOrderByDayAsc();

  Optional<SystemDailyStateEntity> findByDay(LocalDate day);
}
