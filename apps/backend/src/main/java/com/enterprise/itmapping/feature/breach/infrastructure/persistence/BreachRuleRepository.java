package com.enterprise.itmapping.feature.breach.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BreachRuleRepository extends JpaRepository<BreachRuleEntity, UUID> {

  /** Loads the last editor too: the session is closed by the time the list is rendered. */
  @EntityGraph(attributePaths = "updatedBy")
  List<BreachRuleEntity> findAllByOrderByNameAsc();
}
