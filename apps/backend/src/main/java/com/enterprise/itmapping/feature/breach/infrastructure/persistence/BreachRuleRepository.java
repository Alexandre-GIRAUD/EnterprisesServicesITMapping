package com.enterprise.itmapping.feature.breach.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BreachRuleRepository extends JpaRepository<BreachRuleEntity, UUID> {

  List<BreachRuleEntity> findAllByOrderByNameAsc();
}
