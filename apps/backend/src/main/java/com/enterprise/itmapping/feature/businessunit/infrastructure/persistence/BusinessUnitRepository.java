package com.enterprise.itmapping.feature.businessunit.infrastructure.persistence;

import com.enterprise.itmapping.domain.BusinessUnit;
import java.util.List;
import org.springframework.data.neo4j.repository.Neo4jRepository;

public interface BusinessUnitRepository extends Neo4jRepository<BusinessUnit, String> {

  List<BusinessUnit> findAllByOrderByNameAsc();
}
