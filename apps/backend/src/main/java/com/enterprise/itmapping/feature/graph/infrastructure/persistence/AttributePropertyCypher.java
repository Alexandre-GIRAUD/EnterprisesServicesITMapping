package com.enterprise.itmapping.feature.graph.infrastructure.persistence;

/**
 * Cypher fragments that match a Data Model property whether it is still a string or already a list.
 */
final class AttributePropertyCypher {

  private AttributePropertyCypher() {}

  /** True when any stored value is in the bound list. A legacy string still matches. */
  static String matchesAny(String alias, String key, String paramName) {
    String property = alias + ".`" + key + "`";
    return "any(v IN CASE WHEN "
        + property
        + " IS :: LIST<ANY> THEN "
        + property
        + " ELSE ["
        + property
        + "] END WHERE toString(v) IN $"
        + paramName
        + ")";
  }

  /** One row per stored value, including each element of a list property. */
  static String distinctValues(String matchClause, String alias, String key) {
    String property = alias + ".`" + key + "`";
    return matchClause
        + "\nWHERE "
        + property
        + " IS NOT NULL\n"
        + "UNWIND CASE WHEN "
        + property
        + " IS :: LIST<ANY> THEN "
        + property
        + " ELSE ["
        + property
        + "] END AS item\n"
        + "WITH DISTINCT toString(item) AS value\n"
        + "WHERE value IS NOT NULL AND trim(value) <> ''\n"
        + "RETURN value ORDER BY value\n";
  }
}
