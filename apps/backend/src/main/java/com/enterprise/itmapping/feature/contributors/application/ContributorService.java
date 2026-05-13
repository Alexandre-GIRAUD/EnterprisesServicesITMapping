package com.enterprise.itmapping.feature.contributors.application;

import com.enterprise.itmapping.domain.Contributor;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import com.enterprise.itmapping.feature.businessunit.infrastructure.persistence.BusinessUnitRepository;
import com.enterprise.itmapping.feature.contributors.infrastructure.persistence.ContributorRepository;
import com.enterprise.itmapping.feature.contributors.presentation.dto.ContributorDetailResponse;
import com.enterprise.itmapping.feature.contributors.presentation.dto.ContributorLinkedApplicationDto;
import com.enterprise.itmapping.feature.contributors.presentation.dto.ContributorListItemDto;
import com.enterprise.itmapping.feature.contributors.presentation.dto.ContributorSummaryDto;
import com.enterprise.itmapping.feature.contributors.presentation.dto.ContributorWriteRequest;
import com.enterprise.itmapping.feature.applications.presentation.dto.BusinessUnitSummary;
import com.enterprise.itmapping.feature.graph.infrastructure.persistence.Neo4jValueMapping;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Contributors (people) with {@code WORK_IN} → {@code BusinessUnit}, {@code WORK_ON} → {@code
 * Application}, optional {@code REPORTS_TO} → another {@code Contributor} for manager (v1).
 */
@Service
public class ContributorService {

  private static final String DETAIL_HEAD =
      """
      MATCH (c:Contributor {id: $id})
      OPTIONAL MATCH (c)-[:WORK_IN]->(bu:BusinessUnit)
      OPTIONAL MATCH (c)-[:REPORTS_TO]->(mgr:Contributor)
      RETURN c.id AS id, c.firstName AS firstName, c.lastName AS lastName, c.team AS team,
             bu.id AS buId, bu.name AS buName, bu.code AS buCode, bu.description AS buDesc,
             mgr.id AS mgrId, mgr.firstName AS mgrFirstName, mgr.lastName AS mgrLastName
      """;

  private static final String LIST_CYPHER =
      """
      MATCH (c:Contributor)
      RETURN c.id AS id, c.firstName AS firstName, c.lastName AS lastName, c.team AS team
      ORDER BY c.lastName, c.firstName
      """;

  private static final String APPS_CYPHER =
      """
      MATCH (c:Contributor {id: $id})-[:WORK_ON]->(a:Application)
      RETURN a.id AS id, a.name AS name
      ORDER BY a.name
      """;

  private static final String DETACH_DELETE =
      """
      MATCH (c:Contributor {id: $id})
      DETACH DELETE c
      """;

  private final ContributorRepository contributorRepository;
  private final BusinessUnitRepository businessUnitRepository;
  private final ApplicationRepository applicationRepository;
  private final ContributorLinkService contributorLinkService;
  private final Neo4jClient neo4jClient;

  public ContributorService(
      ContributorRepository contributorRepository,
      BusinessUnitRepository businessUnitRepository,
      ApplicationRepository applicationRepository,
      ContributorLinkService contributorLinkService,
      Neo4jClient neo4jClient) {
    this.contributorRepository = contributorRepository;
    this.businessUnitRepository = businessUnitRepository;
    this.applicationRepository = applicationRepository;
    this.contributorLinkService = contributorLinkService;
    this.neo4jClient = neo4jClient;
  }

  @Transactional(readOnly = true)
  public List<ContributorListItemDto> findAll() {
    List<ContributorListItemDto> out = new ArrayList<>();
    neo4jClient
        .query(LIST_CYPHER)
        .fetch()
        .all()
        .forEach(
            row -> {
              Map<String, Object> map = Neo4jValueMapping.asMap(row);
              out.add(
                  new ContributorListItemDto(
                      Neo4jValueMapping.asString(map.get("id")),
                      Neo4jValueMapping.asString(map.get("firstName")),
                      Neo4jValueMapping.asString(map.get("lastName")),
                      Neo4jValueMapping.asString(map.get("team"))));
            });
    return out;
  }

  @Transactional(readOnly = true)
  public Optional<ContributorDetailResponse> findById(String id) {
    return neo4jClient
        .query(DETAIL_HEAD)
        .bind(id)
        .to("id")
        .fetch()
        .first()
        .map(Neo4jValueMapping::asMap)
        .map(m -> mapDetail(m, loadApplications(id)));
  }

  @Transactional
  public ContributorDetailResponse create(ContributorWriteRequest request) {
    validateWriteRequest(request, null);
    Contributor c = new Contributor();
    c.setFirstName(request.firstName().trim());
    c.setLastName(request.lastName().trim());
    c.setTeam(blankToNull(request.team()));
    Contributor saved = contributorRepository.save(c);
    contributorLinkService.replaceAllLinks(saved.getId(), request);
    return findById(saved.getId()).orElseThrow();
  }

  @Transactional
  public Optional<ContributorDetailResponse> update(String id, ContributorWriteRequest request) {
    Optional<Contributor> ref = contributorRepository.findById(id);
    if (ref.isEmpty()) {
      return Optional.empty();
    }
    validateWriteRequest(request, id);
    Contributor existing = ref.get();
    existing.setFirstName(request.firstName().trim());
    existing.setLastName(request.lastName().trim());
    existing.setTeam(blankToNull(request.team()));
    contributorRepository.save(existing);
    contributorLinkService.replaceAllLinks(id, request);
    return findById(id);
  }

  @Transactional
  public boolean delete(String id) {
    if (contributorRepository.findById(id).isEmpty()) {
      return false;
    }
    neo4jClient.query(DETACH_DELETE).bind(id).to("id").run();
    return true;
  }

  private void validateWriteRequest(ContributorWriteRequest request, String contributorId) {
    String mgr = blankToNull(request.managerContributorId());
    if (mgr != null) {
      if (contributorId != null && mgr.equals(contributorId)) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "Un contributor ne peut pas être son propre manager.");
      }
      if (!contributorRepository.existsById(mgr)) {
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Manager introuvable: " + mgr);
      }
    }
    String bu = blankToNull(request.businessUnitId());
    if (bu != null && !businessUnitRepository.existsById(bu)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Business unit introuvable: " + bu);
    }
    for (String raw : request.applicationIds()) {
      if (raw == null || raw.isBlank()) {
        continue;
      }
      String appId = raw.trim();
      if (applicationRepository.findProjectionById(appId).isEmpty()) {
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Application introuvable: " + appId);
      }
    }
  }

  private List<ContributorLinkedApplicationDto> loadApplications(String contributorId) {
    List<ContributorLinkedApplicationDto> apps = new ArrayList<>();
    neo4jClient
        .query(APPS_CYPHER)
        .bind(contributorId)
        .to("id")
        .fetch()
        .all()
        .forEach(
            row -> {
              Map<String, Object> map = Neo4jValueMapping.asMap(row);
              apps.add(
                  new ContributorLinkedApplicationDto(
                      Neo4jValueMapping.asString(map.get("id")),
                      Neo4jValueMapping.asString(map.get("name"))));
            });
    return apps;
  }

  private ContributorDetailResponse mapDetail(
      Map<String, Object> map, List<ContributorLinkedApplicationDto> applications) {
    String buId = Neo4jValueMapping.asString(map.get("buId"));
    BusinessUnitSummary bu =
        buId != null && !buId.isBlank()
            ? new BusinessUnitSummary(
                buId,
                Neo4jValueMapping.asString(map.get("buName")),
                Neo4jValueMapping.asString(map.get("buCode")),
                Neo4jValueMapping.asString(map.get("buDesc")))
            : null;

    String mgrId = Neo4jValueMapping.asString(map.get("mgrId"));
    ContributorSummaryDto mgr =
        mgrId != null && !mgrId.isBlank()
            ? new ContributorSummaryDto(
                mgrId,
                Neo4jValueMapping.asString(map.get("mgrFirstName")),
                Neo4jValueMapping.asString(map.get("mgrLastName")))
            : null;

    return new ContributorDetailResponse(
        Neo4jValueMapping.asString(map.get("id")),
        Neo4jValueMapping.asString(map.get("firstName")),
        Neo4jValueMapping.asString(map.get("lastName")),
        Neo4jValueMapping.asString(map.get("team")),
        bu,
        mgr,
        applications);
  }

  private static String blankToNull(String s) {
    if (s == null) {
      return null;
    }
    String t = s.trim();
    return t.isEmpty() ? null : t;
  }
}
