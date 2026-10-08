package com.enterprise.itmapping.feature.applications.application;

import java.util.ArrayList;
import java.util.List;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Component;

/**
 * Loads the lightweight catalogue of {@code Application} nodes (id + name + optional description)
 * used as context for the connection-discovery agent. Extracted from the suggestion service so the
 * orchestration logic can be unit-tested without the {@link Neo4jClient} fluent chain.
 */
@Component
public class ApplicationCatalogQuery {

  private final Neo4jClient neo4jClient;

  public ApplicationCatalogQuery(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  /** All named applications except {@code excludeApplicationId}, ordered by name. */
  public List<CatalogRow> loadExcluding(String excludeApplicationId) {
    List<CatalogRow> rows = new ArrayList<>();
    neo4jClient
        .query(
            """
            MATCH (a:Application)
            WHERE a.id <> $excludeId AND a.name IS NOT NULL AND trim(a.name) <> ''
            RETURN a.id AS id, a.name AS name, a.description AS description
            ORDER BY a.name
            """)
        .bind(excludeApplicationId)
        .to("excludeId")
        .fetch()
        .all()
        .forEach(
            row -> {
              Object id = row.get("id");
              Object name = row.get("name");
              if (id != null && name != null) {
                rows.add(
                    new CatalogRow(
                        String.valueOf(id),
                        String.valueOf(name),
                        row.get("description") != null
                            ? String.valueOf(row.get("description"))
                            : null));
              }
            });
    return rows;
  }

  /** All named applications, ordered by name (lightweight id+name+description). */
  public List<CatalogRow> loadAllNamed() {
    List<CatalogRow> rows = new ArrayList<>();
    neo4jClient
        .query(
            """
            MATCH (a:Application)
            WHERE a.name IS NOT NULL AND trim(a.name) <> ''
            RETURN a.id AS id, a.name AS name, a.description AS description
            ORDER BY a.name
            """)
        .fetch()
        .all()
        .forEach(
            row -> {
              Object id = row.get("id");
              Object name = row.get("name");
              if (id != null && name != null) {
                rows.add(
                    new CatalogRow(
                        String.valueOf(id),
                        String.valueOf(name),
                        row.get("description") != null
                            ? String.valueOf(row.get("description"))
                            : null));
              }
            });
    return rows;
  }

  /**
   * Case-insensitive name search ({@code CONTAINS}). Exact (ignore-case) matches are listed first,
   * then alphabetical. Empty / blank {@code query} returns an empty list.
   */
  public List<CatalogRow> loadMatching(String query, int limit) {
    if (query == null || query.isBlank()) {
      return List.of();
    }
    int safeLimit = Math.min(50, Math.max(1, limit));
    String q = query.trim();
    List<CatalogRow> rows = new ArrayList<>();
    neo4jClient
        .query(
            """
            MATCH (a:Application)
            WHERE a.name IS NOT NULL AND trim(a.name) <> ''
              AND toLower(a.name) CONTAINS toLower($q)
            RETURN a.id AS id, a.name AS name, a.description AS description,
                   CASE WHEN toLower(trim(a.name)) = toLower($q) THEN 0 ELSE 1 END AS rank
            ORDER BY rank, a.name
            LIMIT $limit
            """)
        .bind(q)
        .to("q")
        .bind(safeLimit)
        .to("limit")
        .fetch()
        .all()
        .forEach(
            row -> {
              Object id = row.get("id");
              Object name = row.get("name");
              if (id != null && name != null) {
                rows.add(
                    new CatalogRow(
                        String.valueOf(id),
                        String.valueOf(name),
                        row.get("description") != null
                            ? String.valueOf(row.get("description"))
                            : null));
              }
            });
    return rows;
  }

  public record CatalogRow(String id, String name, String description) {}
}
