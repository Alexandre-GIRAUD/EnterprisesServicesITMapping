package com.enterprise.itmapping.feature.datamodel.application;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class DataModelRefIdsTest {

  @Test
  void stableIdIsDeterministicForSameFieldAndValue() {
    String a = DataModelRefIds.stableId("tier_ref", "GOLD");
    String b = DataModelRefIds.stableId("tier_ref", " GOLD ");
    assertThat(a).isEqualTo(b);
    assertThat(a).startsWith("ref_tier_ref_");
  }

  @Test
  void stableIdDiffersAcrossFieldKeys() {
    assertThat(DataModelRefIds.stableId("tier_ref", "GOLD"))
        .isNotEqualTo(DataModelRefIds.stableId("zone_x", "GOLD"));
  }
}
