/**
 * Contributors (people) in Neo4j: {@code (:Contributor)-[:WORK_IN]->(:BusinessUnit)} (at most one BU
 * in v1), {@code (:Contributor)-[:WORK_ON]->(:Application)} (many; edges without temporal
 * properties in v1), optional {@code (:Contributor)-[:REPORTS_TO]->(:Contributor)} for manager
 * (graph link, not free-text).
 */
package com.enterprise.itmapping.feature.contributors;
