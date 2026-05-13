package com.enterprise.itmapping.feature.contributors.infrastructure.persistence;

import com.enterprise.itmapping.domain.Contributor;
import org.springframework.data.neo4j.repository.Neo4jRepository;

public interface ContributorRepository extends Neo4jRepository<Contributor, String> {}
