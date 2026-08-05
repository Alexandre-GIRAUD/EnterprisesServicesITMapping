package com.enterprise.itmapping.feature.graph.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.datamodel.application.DataModelService;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelDetection;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelTarget;
import com.enterprise.itmapping.feature.graph.infrastructure.persistence.ApplicationNodeAttributeFacetQuery;
import com.enterprise.itmapping.feature.graph.infrastructure.persistence.DataModelRefFacetQuery;
import com.enterprise.itmapping.feature.graph.infrastructure.persistence.DependsOnEdgeAttributeFacetQuery;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class GraphNodeFilterFacetServiceTest {

  @Mock DataModelService dataModelService;
  @Mock ApplicationNodeAttributeFacetQuery facetQuery;
  @Mock DataModelRefFacetQuery refFacetQuery;
  @Mock DependsOnEdgeAttributeFacetQuery edgeFacetQuery;

  @InjectMocks GraphNodeFilterFacetService service;

  @Test
  void usesDeclaredAllowedValuesWithoutQueryingNeo4j() {
    when(dataModelService.loadConfig())
        .thenReturn(config(nodeField("tier", "Tier", List.of("GOLD", "SILVER"))));

    var filters = service.listNodeFilters();

    assertThat(filters).singleElement().satisfies(f -> {
      assertThat(f.key()).isEqualTo("tier");
      assertThat(f.label()).isEqualTo("Tier");
      assertThat(f.values()).containsExactly("GOLD", "SILVER");
      assertThat(f.fromAllowedValues()).isTrue();
      assertThat(f.kind()).isEqualTo("NODE");
    });
    verify(facetQuery, never()).distinctValues("tier");
  }

  @Test
  void fallsBackToStoredDistinctValues() {
    when(dataModelService.loadConfig())
        .thenReturn(config(nodeField("owner_team", "Owner team", List.of())));
    when(facetQuery.distinctValues("owner_team")).thenReturn(List.of("payments", "retail"));

    var filters = service.listNodeFilters();

    assertThat(filters).singleElement().satisfies(f -> {
      assertThat(f.values()).containsExactly("payments", "retail");
      assertThat(f.fromAllowedValues()).isFalse();
    });
  }

  @Test
  void exposesActiveNodeRefCatalogueOptions() {
    when(dataModelService.loadConfig())
        .thenReturn(config(nodeRefField("tier_ref", "Tier ref", List.of("GOLD", "SILVER"), false)));
    when(refFacetQuery.activeOptions("tier_ref"))
        .thenReturn(
            List.of(
                new DataModelRefFacetQuery.RefOption("id-gold", "GOLD"),
                new DataModelRefFacetQuery.RefOption("id-silver", "SILVER")));

    var filters = service.listNodeFilters();

    assertThat(filters).singleElement().satisfies(f -> {
      assertThat(f.kind()).isEqualTo("NODE_REF");
      assertThat(f.multiple()).isFalse();
      assertThat(f.values()).containsExactly("id-gold", "id-silver");
      assertThat(f.options()).hasSize(2);
      assertThat(f.options().get(0).id()).isEqualTo("id-gold");
      assertThat(f.options().get(0).name()).isEqualTo("GOLD");
    });
  }

  @Test
  void exposesEdgeFieldsWithAllowedValues() {
    when(dataModelService.loadConfig())
        .thenReturn(
            config(
                edgeField(
                    "data_category", "Data category", List.of("ORDER_PAYLOAD", "INVOICE"))));

    var filters = service.listNodeFilters();

    assertThat(filters).singleElement().satisfies(f -> {
      assertThat(f.key()).isEqualTo("data_category");
      assertThat(f.kind()).isEqualTo("EDGE");
      assertThat(f.values()).containsExactly("ORDER_PAYLOAD", "INVOICE");
      assertThat(f.fromAllowedValues()).isTrue();
    });
    verify(edgeFacetQuery, never()).distinctValues("data_category");
  }

  @Test
  void fallsBackToDistinctEdgeValuesWhenNoAllowedValues() {
    when(dataModelService.loadConfig())
        .thenReturn(config(edgeField("flow_nature", "Flow nature", List.of())));
    when(edgeFacetQuery.distinctValues("flow_nature")).thenReturn(List.of("ASYNC", "SYNC"));

    var filters = service.listNodeFilters();

    assertThat(filters).singleElement().satisfies(f -> {
      assertThat(f.kind()).isEqualTo("EDGE");
      assertThat(f.values()).containsExactly("ASYNC", "SYNC");
      assertThat(f.fromAllowedValues()).isFalse();
    });
  }

  private static DataModelConfig config(DataModelField... fields) {
    return new DataModelConfig(List.of(fields));
  }

  private static DataModelField nodeField(String key, String label, List<String> allowedValues) {
    return new DataModelField(
        key,
        label,
        "",
        "",
        allowedValues,
        false,
        false,
        DataModelDetection.AUTOMATIC_DETECTION,
        DataModelTarget.NODE);
  }

  private static DataModelField nodeRefField(
      String key, String label, List<String> allowedValues, boolean multiple) {
    return new DataModelField(
        key,
        label,
        "",
        "",
        allowedValues,
        true,
        false,
        DataModelDetection.AUTOMATIC_DETECTION,
        DataModelTarget.NODE_REF,
        multiple);
  }

  private static DataModelField edgeField(String key, String label, List<String> allowedValues) {
    return new DataModelField(
        key,
        label,
        "",
        "",
        allowedValues,
        false,
        false,
        DataModelDetection.AUTOMATIC_DETECTION,
        DataModelTarget.EDGE);
  }
}
