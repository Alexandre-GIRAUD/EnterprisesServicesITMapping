package com.enterprise.itmapping.feature.history.infrastructure.persistence;

import com.enterprise.itmapping.feature.history.application.SystemState;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "system_daily_states")
public class SystemDailyStateEntity {

  @Id
  @Column(nullable = false, updatable = false)
  private LocalDate day;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private SystemState state;

  @Column(name = "captured_at", nullable = false)
  private Instant capturedAt;

  protected SystemDailyStateEntity() {}

  public SystemDailyStateEntity(LocalDate day, SystemState state, Instant capturedAt) {
    this.day = day;
    this.state = state;
    this.capturedAt = capturedAt;
  }

  public LocalDate getDay() {
    return day;
  }

  public SystemState getState() {
    return state;
  }
}
