package com.enterprise.itmapping.feature.region.infrastructure.persistence;

import com.enterprise.itmapping.domain.Region;
import java.util.List;
import org.springframework.data.neo4j.repository.Neo4jRepository;

public interface RegionRepository extends Neo4jRepository<Region, String> {

  boolean existsByCodeIgnoreCase(String code);

  List<Region> findAllByOrderByCodeAsc();
}
