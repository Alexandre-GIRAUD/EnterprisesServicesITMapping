package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery.CatalogRow;
import java.util.List;
import org.junit.jupiter.api.Test;

class ApplicationNameMatchTest {

  private static final List<CatalogRow> CATALOGUE =
      List.of(
          new CatalogRow("app_1", "Payments", null),
          new CatalogRow("app_2", "Payroll", null),
          new CatalogRow("crm", "Customer directory", null));

  @Test
  void aTypoStillFindsTheApplicationName() {
    List<CatalogRow> matches = ApplicationNameMatch.closest("Paymnts", CATALOGUE, 5);
    assertThat(matches).extracting(CatalogRow::id).containsExactly("app_1");
  }

  @Test
  void spacesAndUnderscoresDoNotChangeTheMatch() {
    List<CatalogRow> matches = ApplicationNameMatch.closest("app 1", CATALOGUE, 5);
    assertThat(matches).extracting(CatalogRow::id).containsExactly("app_1");
    assertThat(ApplicationNameMatch.closest("app1", CATALOGUE, 5))
        .extracting(CatalogRow::id)
        .containsExactly("app_1");
  }

  @Test
  void equallyCloseNamesAreNotPickedSilently() {
    assertThat(ApplicationNameMatch.uniqueClosest("Pay", CATALOGUE)).isNull();
  }
}
