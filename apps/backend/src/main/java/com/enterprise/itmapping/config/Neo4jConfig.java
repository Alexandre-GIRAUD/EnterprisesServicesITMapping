package com.enterprise.itmapping.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.neo4j.repository.config.EnableNeo4jRepositories;

/**
 * Neo4j configuration. Repositories are enabled for the feature packages.
 */
@Configuration
@EnableNeo4jRepositories(basePackages = "com.enterprise.itmapping.feature")
public class Neo4jConfig {
}
