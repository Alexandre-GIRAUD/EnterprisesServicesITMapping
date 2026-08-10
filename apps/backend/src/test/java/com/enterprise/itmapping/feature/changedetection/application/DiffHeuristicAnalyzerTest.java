package com.enterprise.itmapping.feature.changedetection.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelDetection;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelTarget;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubCommitDiffService.DiffFile;
import java.util.List;
import org.junit.jupiter.api.Test;

class DiffHeuristicAnalyzerTest {

  private final DiffHeuristicAnalyzer analyzer = new DiffHeuristicAnalyzer();

  @Test
  void detectsFlowAndModuleSignals() {
    var analysis =
        analyzer.analyze(
            List.of(
                new DiffFile(
                    "src/main/java/com/acme/clients/OrdersClient.java",
                    "modified",
                    "+ RestTemplate rest = new RestTemplate();\n+ String url = \"https://orders.internal/api\";\n",
                    2),
                new DiffFile("pom.xml", "modified", "+ <dependency>\n", 1)),
            new DataModelConfig(List.of()));

    assertThat(analysis.buckets())
        .contains(DiffHeuristicAnalyzer.FLOW_SIGNAL, DiffHeuristicAnalyzer.MODULE_SIGNAL);
  }

  @Test
  void detectsEdgeAttributeFromPatchUsingDataModelKeysOnly() {
    DataModelConfig dm =
        new DataModelConfig(
            List.of(
                new DataModelField(
                    "data_category",
                    "Data category",
                    "",
                    "",
                    List.of("ORDER_PAYLOAD"),
                    true,
                    false,
                    DataModelDetection.MANUAL,
                    DataModelTarget.EDGE)));

    var analysis =
        analyzer.analyze(
            List.of(
                new DiffFile(
                    "src/main/resources/application.yml",
                    "modified",
                    "+ data_category: ORDER_PAYLOAD\n",
                    1)),
            dm);

    assertThat(analysis.buckets()).contains(DiffHeuristicAnalyzer.ATTRIBUTE_SIGNAL);
    assertThat(analysis.attributeHits()).hasSize(1);
    assertThat(analysis.attributeHits().getFirst().key()).isEqualTo("data_category");
    assertThat(analysis.attributeHits().getFirst().value()).isEqualTo("ORDER_PAYLOAD");
    assertThat(analysis.attributeHits().getFirst().target()).isEqualTo("EDGE");
  }
}
