package com.enterprise.itmapping.feature.graph.infrastructure.persistence;

import com.enterprise.itmapping.domain.VersionSnapshot;
import org.springframework.data.neo4j.repository.Neo4jRepository;

public interface VersionSnapshotRepository extends Neo4jRepository<VersionSnapshot, String> {
}
