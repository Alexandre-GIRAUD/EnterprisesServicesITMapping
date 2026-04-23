package com.enterprise.itmapping.config;

import com.enterprise.itmapping.common.Neo4jTemporalParameters;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Component;

/**
 * Inserts a small demo graph (applications and DEPENDS_ON edges) when the database has no applications.
 * Disable via application property app.sample-data.seed=false.
 */
@Component
@Order(100)
public class SampleGraphDataSeeder implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(SampleGraphDataSeeder.class);

  private final Neo4jClient neo4jClient;

  @Value("${app.sample-data.seed:true}")
  private boolean seedEnabled;

  @Value("${app.sample-data.max-attempts:30}")
  private int maxAttempts;

  @Value("${app.sample-data.retry-delay-ms:2000}")
  private long retryDelayMs;

  public SampleGraphDataSeeder(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  @Override
  public void run(ApplicationArguments args) {
    if (!seedEnabled) {
      return;
    }
    for (int attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        long count =
            neo4jClient
                .query("MATCH (a:Application) RETURN count(a) AS c")
                .fetch()
                .first()
                .map(
                    row -> {
                      Object v = row.get("c");
                      if (v instanceof Number) {
                        return ((Number) v).longValue();
                      }
                      return 0L;
                    })
                .orElse(0L);
        if (count > 0) {
          log.debug("Skipping sample graph seed: {} application(s) already present", count);
          return;
        }
        insertSampleGraph();
        log.info("Sample graph data loaded (demo applications and dependencies)");
        return;
      } catch (Exception e) {
        if (attempt >= maxAttempts) {
          log.error(
              "Could not seed sample graph after {} attempts (Neo4j unreachable or error). Last error: {}",
              maxAttempts,
              e.getMessage());
          log.debug("Seed failure details", e);
          return;
        }
        log.warn(
            "Sample graph seed attempt {}/{} failed ({}), retrying in {} ms",
            attempt,
            maxAttempts,
            e.getMessage(),
            retryDelayMs);
        sleepQuietly(retryDelayMs);
      }
    }
  }

  private static void sleepQuietly(long ms) {
    try {
      Thread.sleep(ms);
    } catch (InterruptedException ie) {
      Thread.currentThread().interrupt();
    }
  }

  private void insertSampleGraph() {
    Instant vf = Instant.now().minusSeconds(86400 * 30);
    String p = UUID.randomUUID().toString();
    String g = UUID.randomUUID().toString();
    String o = UUID.randomUUID().toString();
    String c = UUID.randomUUID().toString();
    String pay = UUID.randomUUID().toString();
    String modUi = UUID.randomUUID().toString();
    String modApi = UUID.randomUUID().toString();
    String modPkg = UUID.randomUUID().toString();

    String createApps;
    try (InputStream in = new ClassPathResource("seed/sample-graph.cypher").getInputStream()) {
      createApps = new String(in.readAllBytes(), StandardCharsets.UTF_8);
    } catch (IOException e) {
      throw new IllegalStateException("Classpath resource seed/sample-graph.cypher is missing", e);
    }

    Map<String, Object> params = new HashMap<>();
    params.put("portalId", p);
    params.put("gatewayId", g);
    params.put("ordersId", o);
    params.put("customersId", c);
    params.put("paymentsId", pay);
    params.put("modUiId", modUi);
    params.put("modApiId", modApi);
    params.put("modPkgId", modPkg);
    params.put("vf", Neo4jTemporalParameters.toNeo4j(vf));
    neo4jClient.query(createApps).bindAll(params).run();
  }
}
