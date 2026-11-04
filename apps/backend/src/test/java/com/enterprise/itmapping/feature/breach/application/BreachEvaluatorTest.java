package com.enterprise.itmapping.feature.breach.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.enterprise.itmapping.feature.breach.domain.BreachCombinator;
import com.enterprise.itmapping.feature.breach.domain.BreachCondition;
import com.enterprise.itmapping.feature.breach.domain.BreachDefinition;
import com.enterprise.itmapping.feature.breach.domain.BreachGroup;
import com.enterprise.itmapping.feature.breach.domain.BreachOperator;
import com.enterprise.itmapping.feature.breach.domain.BreachRule;
import com.enterprise.itmapping.feature.breach.domain.BreachScope;
import com.enterprise.itmapping.feature.breach.domain.BreachSubject;
import com.enterprise.itmapping.feature.graph.application.dto.GraphEdgeDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class BreachEvaluatorTest {

  private final BreachEvaluator evaluator = new BreachEvaluator();

  private static GraphNodeDto app(String id, Map<String, ?> properties) {
    return new GraphNodeDto(id, "App " + id, "Application", null, properties);
  }

  private static GraphEdgeDto flow(String id, String source, String target, Map<String, Object> properties) {
    return new GraphEdgeDto(id, source, target, "DEPENDS_ON", null, properties);
  }

  private static BreachCondition condition(
      BreachScope scope, String attribute, BreachOperator operator, String value) {
    return new BreachCondition(scope, attribute, operator, value);
  }

  private static BreachRule rule(BreachSubject subject, BreachCombinator combinator, BreachGroup... groups) {
    return new BreachRule(
        UUID.randomUUID(), "rule", subject, new BreachDefinition(combinator, List.of(groups)));
  }

  private static BreachGroup group(BreachCombinator combinator, BreachCondition... conditions) {
    return new BreachGroup(combinator, List.of(conditions));
  }

  private static BreachRule single(BreachSubject subject, BreachCondition condition) {
    return rule(subject, BreachCombinator.AND, group(BreachCombinator.AND, condition));
  }

  private static List<String> ids(List<BreachElement> elements) {
    return elements.stream().map(BreachElement::id).toList();
  }

  @Test
  void flagsApplicationsWhoseCostIsAboveTheThreshold() {
    GraphResponseDto graph =
        new GraphResponseDto(
            List.of(
                app("a", Map.of("cost", "150k")),
                app("b", Map.of("cost", "90 000")),
                app("c", Map.of()),
                app("d", Map.of("cost", "expensive"))),
            List.of());

    BreachResult result =
        evaluator.evaluate(
            single(
                BreachSubject.APPLICATION,
                condition(BreachScope.SELF, "cost", BreachOperator.GREATER_THAN, "100k")),
            graph);

    assertThat(ids(result.breaches())).containsExactly("a");
    assertThat(ids(result.unknown())).containsExactly("c", "d");
    assertThat(result.breaches().get(0).values())
        .containsExactly(new BreachTestedValue(BreachScope.SELF, "cost", List.of("150k")));
  }

  @Test
  void comparesTextIgnoringCaseAndMatchesAnyValueOfAList() {
    GraphResponseDto graph =
        new GraphResponseDto(
            List.of(
                app("a", Map.of("tags", List.of("core", "LEGACY"))),
                app("b", Map.of("tags", List.of("core"))),
                app("c", Map.of("status", "Legacy app"))),
            List.of());

    assertThat(
            ids(
                evaluator
                    .evaluate(
                        single(
                            BreachSubject.APPLICATION,
                            condition(BreachScope.SELF, "tags", BreachOperator.EQUALS, "legacy")),
                        graph)
                    .breaches()))
        .containsExactly("a");
    assertThat(
            ids(
                evaluator
                    .evaluate(
                        single(
                            BreachSubject.APPLICATION,
                            condition(BreachScope.SELF, "tags", BreachOperator.NOT_EQUALS, "legacy")),
                        graph)
                    .breaches()))
        .containsExactly("b");
    assertThat(
            ids(
                evaluator
                    .evaluate(
                        single(
                            BreachSubject.APPLICATION,
                            condition(BreachScope.SELF, "status", BreachOperator.CONTAINS, "LEGACY")),
                        graph)
                    .breaches()))
        .containsExactly("c");
  }

  @Test
  void emptinessOperatorsAreNeverUnknown() {
    GraphResponseDto graph =
        new GraphResponseDto(
            List.of(app("a", Map.of("owner", "")), app("b", Map.of("owner", "Ops"))), List.of());

    BreachResult empty =
        evaluator.evaluate(
            single(BreachSubject.APPLICATION, condition(BreachScope.SELF, "owner", BreachOperator.IS_EMPTY, null)),
            graph);
    BreachResult notEmpty =
        evaluator.evaluate(
            single(
                BreachSubject.APPLICATION,
                condition(BreachScope.SELF, "owner", BreachOperator.IS_NOT_EMPTY, null)),
            graph);

    assertThat(ids(empty.breaches())).containsExactly("a");
    assertThat(empty.unknown()).isEmpty();
    assertThat(ids(notEmpty.breaches())).containsExactly("b");
    assertThat(notEmpty.unknown()).isEmpty();
  }

  @Test
  void combinesGroupsWithThreeValuedLogic() {
    // (cost > 100k AND criticality = high) OR (status = legacy)
    BreachRule rule =
        rule(
            BreachSubject.APPLICATION,
            BreachCombinator.OR,
            group(
                BreachCombinator.AND,
                condition(BreachScope.SELF, "cost", BreachOperator.GREATER_THAN, "100k"),
                condition(BreachScope.SELF, "criticality", BreachOperator.EQUALS, "high")),
            group(
                BreachCombinator.AND,
                condition(BreachScope.SELF, "status", BreachOperator.EQUALS, "legacy")));
    GraphResponseDto graph =
        new GraphResponseDto(
            List.of(
                app("expensiveCritical", Map.of("cost", "200k", "criticality", "high", "status", "live")),
                app("cheapUnknownStatus", Map.of("cost", "1k", "criticality", "high")),
                app("legacyOnly", Map.of("status", "legacy")),
                app("unknownCost", Map.of("criticality", "high", "status", "live")),
                app("lowCriticality", Map.of("criticality", "low", "status", "live"))),
            List.of());

    BreachResult result = evaluator.evaluate(rule, graph);

    assertThat(ids(result.breaches())).containsExactly("expensiveCritical", "legacyOnly");
    assertThat(ids(result.unknown())).containsExactly("cheapUnknownStatus", "unknownCost");
  }

  @Test
  void flowRuleReadsTheFlowAndItsSourceOrTarget() {
    // Flow.protocol = FTP AND (Source or target).cost > 100k
    BreachRule rule =
        rule(
            BreachSubject.FLOW,
            BreachCombinator.AND,
            group(
                BreachCombinator.AND,
                condition(BreachScope.FLOW, "protocol", BreachOperator.EQUALS, "FTP"),
                condition(BreachScope.SOURCE_OR_TARGET, "cost", BreachOperator.GREATER_THAN, "100k")));
    GraphResponseDto graph =
        new GraphResponseDto(
            List.of(
                app("cheap", Map.of("cost", "10k")),
                app("expensive", Map.of("cost", "1M")),
                app("blank", Map.of())),
            List.of(
                flow("toExpensive", "cheap", "expensive", Map.of("protocol", "ftp")),
                flow("cheapOnly", "cheap", "cheap", Map.of("protocol", "FTP")),
                flow("https", "cheap", "expensive", Map.of("protocol", "HTTPS")),
                flow("toBlank", "cheap", "blank", Map.of("protocol", "FTP"))));

    BreachResult result = evaluator.evaluate(rule, graph);

    assertThat(ids(result.breaches())).containsExactly("toExpensive");
    assertThat(ids(result.unknown())).containsExactly("toBlank");
    BreachElement flagged = result.breaches().get(0);
    assertThat(flagged.kind()).isEqualTo(BreachSubject.FLOW);
    assertThat(flagged.source()).isEqualTo(new BreachEndpoint("cheap", "App cheap"));
    assertThat(flagged.target()).isEqualTo(new BreachEndpoint("expensive", "App expensive"));
  }

  @Test
  void flowRuleReadsSourceAndTargetSeparately() {
    GraphResponseDto graph =
        new GraphResponseDto(
            List.of(app("cheap", Map.of("cost", "10k")), app("expensive", Map.of("cost", "1M"))),
            List.of(
                flow("out", "expensive", "cheap", Map.of()), flow("in", "cheap", "expensive", Map.of())));

    assertThat(
            ids(
                evaluator
                    .evaluate(
                        single(
                            BreachSubject.FLOW,
                            condition(BreachScope.SOURCE, "cost", BreachOperator.GREATER_THAN, "100k")),
                        graph)
                    .breaches()))
        .containsExactly("out");
    assertThat(
            ids(
                evaluator
                    .evaluate(
                        single(
                            BreachSubject.FLOW,
                            condition(BreachScope.TARGET, "cost", BreachOperator.GREATER_THAN, "100k")),
                        graph)
                    .breaches()))
        .containsExactly("in");
  }

  @Test
  void applicationRuleCanRequireAtLeastOneFlowInADirection() {
    GraphResponseDto graph =
        new GraphResponseDto(
            List.of(app("a", Map.of()), app("b", Map.of()), app("c", Map.of())),
            List.of(
                flow("ab", "a", "b", Map.of("protocol", "FTP")),
                flow("cb", "c", "b", Map.of("protocol", "HTTPS"))));

    assertThat(
            ids(
                evaluator
                    .evaluate(
                        single(
                            BreachSubject.APPLICATION,
                            condition(BreachScope.ANY_FLOW_OUT, "protocol", BreachOperator.EQUALS, "FTP")),
                        graph)
                    .breaches()))
        .containsExactly("a");
    assertThat(
            ids(
                evaluator
                    .evaluate(
                        single(
                            BreachSubject.APPLICATION,
                            condition(BreachScope.ANY_FLOW_IN, "protocol", BreachOperator.EQUALS, "FTP")),
                        graph)
                    .breaches()))
        .containsExactly("b");
    BreachResult anyFlow =
        evaluator.evaluate(
            single(
                BreachSubject.APPLICATION,
                condition(BreachScope.ANY_FLOW, "protocol", BreachOperator.EQUALS, "FTP")),
            graph);
    assertThat(ids(anyFlow.breaches())).containsExactly("a", "b");
    assertThat(anyFlow.unknown()).isEmpty();
  }

  @Test
  void readsCatalogueNamesOfReferenceAttributes() {
    GraphNodeDto classified =
        new GraphNodeDto(
            "a", "App a", "Application", null, Map.of(), Map.of("domain", List.of("Payments")));
    GraphResponseDto graph = new GraphResponseDto(List.of(classified, app("b", Map.of())), List.of());

    BreachResult result =
        evaluator.evaluate(
            single(
                BreachSubject.APPLICATION,
                condition(BreachScope.SELF, "domain", BreachOperator.EQUALS, "payments")),
            graph);

    assertThat(ids(result.breaches())).containsExactly("a");
    assertThat(ids(result.unknown())).containsExactly("b");
  }
}
