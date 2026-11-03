package com.enterprise.itmapping.feature.referential.infrastructure.persistence;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReferentialRepository extends JpaRepository<ReferentialSourceEntity, UUID> {}
