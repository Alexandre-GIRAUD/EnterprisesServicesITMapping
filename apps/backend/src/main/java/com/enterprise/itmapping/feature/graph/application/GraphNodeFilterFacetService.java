package com.enterprise.itmapping.feature.graph.application;

import com.enterprise.itmapping.feature.datamodel.application.DataModelService;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeFilterDto.GraphFilterOptionDto;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeFilterDto;
import com.enterprise.itmapping.feature.graph.infrastructure.persistence.ApplicationNodeAttributeFacetQuery;
import com.enterprise.itmapping.feature.graph.infrastructure.persistence.DataModelRefFacetQuery;
import com.enterprise.itmapping.feature.graph.infrastructure.persistence.DependsOnEdgeAttributeFacetQuery;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Builds filterable dimensions from Data Model {@code NODE}, {@code NODE_REF} and {@code EDGE}
 * fields (served by the historical {@code GET /graph/node-filters} endpoint).
 */
@Service
public class GraphNodeFilterFacetService {

  private final DataModelService dataModelService;
  private final ApplicationNodeAttributeFacetQuery facetQuery;
  private final DataModelRefFacetQuery refFacetQuery;
  private final DependsOnEdgeAttributeFacetQuery edgeFacetQuery;

  public GraphNodeFilterFacetService(
      DataModelService dataModelService,
      ApplicationNodeAttributeFacetQuery facetQuery,
      DataModelRefFacetQuery refFacetQuery,
      DependsOnEdgeAttributeFacetQuery edgeFacetQuery) {
    this.dataModelService = dataModelService;
    this.facetQuery = facetQuery;
    this.refFacetQuery = refFacetQuery;
    this.edgeFacetQuery = edgeFacetQuery;
  }

  @Transactional(readOnly = true)
  public List<GraphNodeFilterDto> listNodeFilters() {
    var config = dataModelService.loadConfig();
    List<GraphNodeFilterDto> out = new ArrayList<>();

    for (DataModelField field : config.nodeFields()) {
      boolean fromAllowedValues = !field.allowedValues().isEmpty();
      List<String> values =
          withEmpty(
              fromAllowedValues ? field.allowedValues() : facetQuery.distinctValues(field.key()),
              facetQuery.hasBlank(field.key()));
      out.add(
          new GraphNodeFilterDto(
              field.key(), labelOf(field), values, fromAllowedValues, "NODE", false, List.of()));
    }

    for (DataModelField field : config.nodeRefFields()) {
      List<DataModelRefFacetQuery.RefOption> refs = refFacetQuery.activeOptions(field.key());
      List<GraphFilterOptionDto> options =
          refs.stream().map(r -> new GraphFilterOptionDto(r.id(), r.name())).toList();
      List<GraphFilterOptionDto> optionsWithEmpty = new ArrayList<>(options);
      if (refFacetQuery.hasUnclassified(field.key())) {
        optionsWithEmpty.add(0, new GraphFilterOptionDto(AttributeMatch.EMPTY, "empty"));
      }
      List<String> ids = optionsWithEmpty.stream().map(GraphFilterOptionDto::id).toList();
      out.add(
          new GraphNodeFilterDto(
              field.key(),
              labelOf(field),
              ids,
              true,
              "NODE_REF",
              field.multiple(),
              optionsWithEmpty));
    }

    for (DataModelField field : config.edgeFields()) {
      boolean fromAllowedValues = !field.allowedValues().isEmpty();
      List<String> values =
          withEmpty(
              fromAllowedValues ? field.allowedValues() : edgeFacetQuery.distinctValues(field.key()),
              edgeFacetQuery.hasBlank(field.key()));
      out.add(
          new GraphNodeFilterDto(
              field.key(), labelOf(field), values, fromAllowedValues, "EDGE", false, List.of()));
    }

    return List.copyOf(out);
  }

  private static List<String> withEmpty(List<String> values, boolean hasEmpty) {
    if (!hasEmpty || values.contains(AttributeMatch.EMPTY)) {
      return values;
    }
    List<String> next = new ArrayList<>();
    next.add(AttributeMatch.EMPTY);
    next.addAll(values);
    return next;
  }

  private static String labelOf(DataModelField field) {
    return field.label() != null && !field.label().isBlank() ? field.label() : field.key();
  }
}
