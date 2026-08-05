package com.enterprise.itmapping.feature.graph.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelDetection;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelTarget;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class GraphNodeFilterResolverTest {

  private final GraphNodeFilterResolver resolver = new GraphNodeFilterResolver();

  @Test
  void keepsNodeFieldsRegardlessOfDetection() {
    Map<String, List<String>> raw = new LinkedHashMap<>();
    raw.put("tier", List.of("GOLD"));
    raw.put("owner_team", List.of("payments"));

    var resolved =
        resolver.resolve(
            config(
                nodeField("tier", DataModelDetection.AUTOMATIC_DETECTION),
                nodeField("owner_team", DataModelDetection.MANUAL)),
            raw);

    assertThat(resolved.filters()).containsOnlyKeys("tier", "owner_team");
    assertThat(resolved.rejectedKeys()).isEmpty();
  }

  @Test
  void rejectsEdgeFieldsWhenPassedAsNodeAttributes() {
    Map<String, List<String>> raw = new LinkedHashMap<>();
    raw.put("channel", List.of("KAFKA"));
    raw.put("not_in_model", List.of("x"));

    var resolved = resolver.resolve(config(edgeField("channel")), raw);

    assertThat(resolved.filters()).isEmpty();
    assertThat(resolved.rejectedKeys()).containsExactlyInAnyOrder("channel", "not_in_model");
  }

  @Test
  void keepsEdgeAttributesSeparately() {
    Map<String, List<String>> attrs = Map.of("tier", List.of("GOLD"));
    Map<String, List<String>> refs = Map.of("tier_ref", List.of("id-a"));
    Map<String, List<String>> edges =
        Map.of(
            "data_category", List.of("ORDER_PAYLOAD"),
            "flow_nature", List.of("SYNC", "ASYNC"));

    var resolved =
        resolver.resolve(
            config(
                nodeField("tier", DataModelDetection.AUTOMATIC_DETECTION),
                nodeRefField("tier_ref"),
                edgeField("data_category"),
                edgeField("flow_nature")),
            attrs,
            refs,
            edges);

    assertThat(resolved.nodeAttributes()).containsExactly(Map.entry("tier", List.of("GOLD")));
    assertThat(resolved.nodeRefs()).containsExactly(Map.entry("tier_ref", List.of("id-a")));
    assertThat(resolved.edgeAttributes())
        .containsOnly(
            Map.entry("data_category", List.of("ORDER_PAYLOAD")),
            Map.entry("flow_nature", List.of("SYNC", "ASYNC")));
    assertThat(resolved.rejectedKeys()).isEmpty();
  }

  @Test
  void rejectsUndeclaredEdgeKeys() {
    var resolved =
        resolver.resolve(
            config(edgeField("data_category")),
            Map.of(),
            Map.of(),
            Map.of("unknown_edge", List.of("X"), "data_category", List.of("ORDER_PAYLOAD")));

    assertThat(resolved.edgeAttributes())
        .containsExactly(Map.entry("data_category", List.of("ORDER_PAYLOAD")));
    assertThat(resolved.rejectedKeys()).containsExactly("unknown_edge");
  }

  @Test
  void normalizesKeyCaseAndDropsBlankValues() {
    Map<String, List<String>> raw = new LinkedHashMap<>();
    raw.put(" TIER ", List.of(" GOLD ", "", "GOLD"));
    raw.put("region", List.of("  "));

    var resolved =
        resolver.resolve(
            config(
                nodeField("tier", DataModelDetection.AUTOMATIC_DETECTION),
                nodeField("region", DataModelDetection.AUTOMATIC_DETECTION)),
            raw);

    assertThat(resolved.filters()).containsExactly(Map.entry("tier", List.of("GOLD")));
  }

  @Test
  void emptyInputIsNoFilter() {
    assertThat(resolver.resolve(config(), Map.of()).isEmpty()).isTrue();
    assertThat(resolver.resolve(config(), null).isEmpty()).isTrue();
  }

  @Test
  void keepsNodeRefKeysSeparatelyFromNodeAttributes() {
    Map<String, List<String>> attrs = Map.of("tier", List.of("GOLD"));
    Map<String, List<String>> refs = Map.of("tier_ref", List.of("id-a", "id-b"));

    var resolved =
        resolver.resolve(
            config(
                nodeField("tier", DataModelDetection.AUTOMATIC_DETECTION),
                nodeRefField("tier_ref")),
            attrs,
            refs);

    assertThat(resolved.nodeAttributes()).containsExactly(Map.entry("tier", List.of("GOLD")));
    assertThat(resolved.nodeRefs()).containsExactly(Map.entry("tier_ref", List.of("id-a", "id-b")));
    assertThat(resolved.rejectedKeys()).isEmpty();
  }

  @Test
  void rejectsAttrKeyUsedAsRefAndViceVersa() {
    var resolved =
        resolver.resolve(
            config(nodeRefField("tier_ref")),
            Map.of("tier_ref", List.of("GOLD")),
            Map.of("unknown_ref", List.of("id-1")));

    assertThat(resolved.nodeAttributes()).isEmpty();
    assertThat(resolved.nodeRefs()).isEmpty();
    assertThat(resolved.rejectedKeys()).containsExactlyInAnyOrder("tier_ref", "unknown_ref");
  }

  private static DataModelConfig config(DataModelField... fields) {
    return new DataModelConfig(List.of(fields));
  }

  private static DataModelField nodeField(String key, DataModelDetection detection) {
    return new DataModelField(
        key, key, "", "", List.of(), false, false, detection, DataModelTarget.NODE);
  }

  private static DataModelField nodeRefField(String key) {
    return new DataModelField(
        key,
        key,
        "",
        "",
        List.of("A"),
        true,
        false,
        DataModelDetection.AUTOMATIC_DETECTION,
        DataModelTarget.NODE_REF);
  }

  private static DataModelField edgeField(String key) {
    return new DataModelField(
        key,
        key,
        "",
        "",
        List.of(),
        false,
        false,
        DataModelDetection.AUTOMATIC_DETECTION,
        DataModelTarget.EDGE);
  }
}
