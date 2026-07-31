package com.enterprise.itmapping.feature.graph.application;

import com.enterprise.itmapping.feature.datamodel.application.DataModelService;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeFilterDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeFilterDto.GraphFilterOptionDto;
import com.enterprise.itmapping.feature.graph.infrastructure.persistence.ApplicationNodeAttributeFacetQuery;
import com.enterprise.itmapping.feature.graph.infrastructure.persistence.DataModelRefFacetQuery;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Builds filterable dimensions from Data Model {@code NODE} and {@code NODE_REF} fields.
 */
@Service
public class GraphNodeFilterFacetService {

  private final DataModelService dataModelService;
  private final ApplicationNodeAttributeFacetQuery facetQuery;
  private final DataModelRefFacetQuery refFacetQuery;

  public GraphNodeFilterFacetService(
      DataModelService dataModelService,
      ApplicationNodeAttributeFacetQuery facetQuery,
      DataModelRefFacetQuery refFacetQuery) {
    this.dataModelService = dataModelService;
    this.facetQuery = facetQuery;
    this.refFacetQuery = refFacetQuery;
  }

  @Transactional(readOnly = true)
  public List<GraphNodeFilterDto> listNodeFilters() {
    var config = dataModelService.loadConfig();
    List<GraphNodeFilterDto> out = new ArrayList<>();

    for (DataModelField field : config.nodeFields()) {
      boolean fromAllowedValues = !field.allowedValues().isEmpty();
      List<String> values =
          fromAllowedValues ? field.allowedValues() : facetQuery.distinctValues(field.key());
      out.add(
          new GraphNodeFilterDto(
              field.key(), labelOf(field), values, fromAllowedValues, "NODE", false, List.of()));
    }

    for (DataModelField field : config.nodeRefFields()) {
      List<DataModelRefFacetQuery.RefOption> refs = refFacetQuery.activeOptions(field.key());
      List<GraphFilterOptionDto> options =
          refs.stream().map(r -> new GraphFilterOptionDto(r.id(), r.name())).toList();
      List<String> ids = options.stream().map(GraphFilterOptionDto::id).toList();
      out.add(
          new GraphNodeFilterDto(
              field.key(),
              labelOf(field),
              ids,
              true,
              "NODE_REF",
              field.multiple(),
              options));
    }

    return List.copyOf(out);
  }

  private static String labelOf(DataModelField field) {
    return field.label() != null && !field.label().isBlank() ? field.label() : field.key();
  }
}
