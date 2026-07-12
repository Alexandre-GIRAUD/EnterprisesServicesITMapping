package com.enterprise.itmapping.config;

import jakarta.persistence.EntityManagerFactory;
import org.neo4j.driver.Driver;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.transaction.TransactionManagerCustomizers;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.neo4j.core.DatabaseSelectionProvider;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.data.neo4j.core.Neo4jOperations;
import org.springframework.data.neo4j.core.Neo4jTemplate;
import org.springframework.data.neo4j.core.mapping.Neo4jMappingContext;
import org.springframework.data.neo4j.core.transaction.Neo4jTransactionManager;
import org.springframework.data.neo4j.repository.config.EnableNeo4jRepositories;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.transaction.PlatformTransactionManager;

/**
 * Neo4j + JPA coexistence (Postgres users, Neo4j graph). Spring Boot only auto-configures one default
 * {@code TransactionManager}; with both starters, Neo4j repositories fail ({@code txTemplate is null})
 * and JPA may miss its {@code transactionManager} bean. We register both explicitly.
 */
@Configuration
@EnableNeo4jRepositories(basePackages = "com.enterprise.itmapping.feature")
public class Neo4jConfig {

  /** Primary TM for {@code @Transactional} on JPA services (users, snapshots). */
  @Bean(name = "transactionManager")
  @Primary
  public PlatformTransactionManager jpaTransactionManager(EntityManagerFactory emf) {
    return new JpaTransactionManager(emf);
  }

  /** Dedicated TM for Spring Data Neo4j repositories and Neo4j {@code @Transactional}. */
  @Bean(name = "neo4jTransactionManager")
  public Neo4jTransactionManager neo4jTransactionManager(
      Driver driver,
      DatabaseSelectionProvider databaseNameProvider,
      ObjectProvider<TransactionManagerCustomizers> optionalCustomizers) {
    Neo4jTransactionManager txManager = new Neo4jTransactionManager(driver, databaseNameProvider);
    optionalCustomizers.ifAvailable(customizers -> customizers.customize(txManager));
    return txManager;
  }

  @Bean
  @ConditionalOnMissingBean(Neo4jOperations.class)
  public Neo4jTemplate neo4jTemplate(
      Neo4jClient neo4jClient,
      Neo4jMappingContext neo4jMappingContext,
      Neo4jTransactionManager neo4jTransactionManager) {
    return new Neo4jTemplate(neo4jClient, neo4jMappingContext, neo4jTransactionManager);
  }
}
