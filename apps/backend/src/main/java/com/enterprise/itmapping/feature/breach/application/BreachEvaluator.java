package com.enterprise.itmapping.feature.breach.application;

import com.enterprise.itmapping.feature.breach.domain.BreachCondition;
import com.enterprise.itmapping.feature.breach.domain.BreachDefinition;
import com.enterprise.itmapping.feature.breach.domain.BreachGroup;
import com.enterprise.itmapping.feature.breach.domain.BreachNumber;
import com.enterprise.itmapping.feature.breach.domain.BreachOperator;
import com.enterprise.itmapping.feature.breach.domain.BreachRule;
import com.enterprise.itmapping.feature.breach.domain.BreachSubject;
import com.enterprise.itmapping.feature.breach.domain.Truth;
import com.enterprise.itmapping.feature.graph.application.dto.GraphEdgeDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

/** Evaluates a breach rule over a graph, with three-valued logic (see the Breach spec). */
@Component
public class BreachEvaluator {

  public BreachResult evaluate(BreachRule rule, GraphResponseDto graph) {
    GraphIndex index = new GraphIndex(graph);
    List<BreachElement> breaches = new ArrayList<>();
    List<BreachElement> unknown = new ArrayList<>();
    for (Subject subject : subjects(rule.subject(), index)) {
      Truth truth = evaluate(rule.definition(), subject, index);
      if (truth == Truth.TRUE) {
        breaches.add(toElement(subject, rule.definition(), index));
      } else if (truth == Truth.UNKNOWN) {
        unknown.add(toElement(subject, rule.definition(), index));
      }
    }
    return new BreachResult(breaches, unknown);
  }

  private static List<Subject> subjects(BreachSubject kind, GraphIndex index) {
    if (kind == BreachSubject.APPLICATION) {
      return index.nodes().stream().map(Subject::ofNode).toList();
    }
    return index.edges().stream().map(Subject::ofEdge).toList();
  }

  private static Truth evaluate(BreachDefinition definition, Subject subject, GraphIndex index) {
    Truth result = definition.combinator().identity();
    for (BreachGroup group : definition.groups()) {
      result = definition.combinator().combine(result, evaluate(group, subject, index));
    }
    return result;
  }

  private static Truth evaluate(BreachGroup group, Subject subject, GraphIndex index) {
    Truth result = group.combinator().identity();
    for (BreachCondition condition : group.conditions()) {
      result = group.combinator().combine(result, evaluate(condition, subject, index));
    }
    return result;
  }

  /** A scope that reads several elements (source or target, any flow) holds when one of them does. */
  private static Truth evaluate(BreachCondition condition, Subject subject, GraphIndex index) {
    List<List<String>> readings = readings(condition, subject, index);
    if (readings.isEmpty()) {
      return Truth.FALSE;
    }
    Truth result = Truth.FALSE;
    for (List<String> values : readings) {
      result = result.or(test(condition, values));
    }
    return result;
  }

  /** The value lists of every element the condition scope names, one list per element. */
  private static List<List<String>> readings(
      BreachCondition condition, Subject subject, GraphIndex index) {
    String key = condition.attribute();
    return switch (condition.scope()) {
      case SELF -> List.of(nodeValues(subject.node(), key));
      case ANY_FLOW_IN -> edgeReadings(index.incoming(subject.node().id()), key);
      case ANY_FLOW_OUT -> edgeReadings(index.outgoing(subject.node().id()), key);
      case ANY_FLOW -> edgeReadings(index.incident(subject.node().id()), key);
      case FLOW -> List.of(edgeValues(subject.edge(), key));
      case SOURCE -> List.of(nodeValues(index.node(subject.edge().sourceId()), key));
      case TARGET -> List.of(nodeValues(index.node(subject.edge().targetId()), key));
      case SOURCE_OR_TARGET ->
          List.of(
              nodeValues(index.node(subject.edge().sourceId()), key),
              nodeValues(index.node(subject.edge().targetId()), key));
    };
  }

  private static List<List<String>> edgeReadings(List<GraphEdgeDto> edges, String key) {
    return edges.stream().map(edge -> edgeValues(edge, key)).toList();
  }

  private static Truth test(BreachCondition condition, List<String> values) {
    BreachOperator operator = condition.operator();
    if (operator == BreachOperator.IS_EMPTY) {
      return Truth.of(values.isEmpty());
    }
    if (operator == BreachOperator.IS_NOT_EMPTY) {
      return Truth.of(!values.isEmpty());
    }
    if (values.isEmpty()) {
      return Truth.UNKNOWN;
    }
    if (operator.isNumeric()) {
      return testNumbers(operator, values, BreachNumber.parse(condition.value()));
    }
    String expected = condition.value().toLowerCase(Locale.ROOT);
    return switch (operator) {
      case EQUALS -> Truth.of(values.stream().anyMatch(value -> lower(value).equals(expected)));
      case NOT_EQUALS -> Truth.of(values.stream().noneMatch(value -> lower(value).equals(expected)));
      case CONTAINS -> Truth.of(values.stream().anyMatch(value -> lower(value).contains(expected)));
      default -> throw new IllegalStateException("Unhandled operator " + operator);
    };
  }

  private static Truth testNumbers(BreachOperator operator, List<String> values, Double expected) {
    if (expected == null) {
      return Truth.UNKNOWN;
    }
    Truth result = Truth.FALSE;
    for (String value : values) {
      Double actual = BreachNumber.parse(value);
      result = result.or(actual == null ? Truth.UNKNOWN : Truth.of(operator.compare(actual, expected)));
    }
    return result;
  }

  private static String lower(String value) {
    return value.toLowerCase(Locale.ROOT);
  }

  private static BreachElement toElement(Subject subject, BreachDefinition definition, GraphIndex index) {
    List<BreachTestedValue> tested = testedValues(subject, definition, index);
    if (subject.node() != null) {
      GraphNodeDto node = subject.node();
      return new BreachElement(
          BreachSubject.APPLICATION, node.id(), node.label(), null, null, null, null, tested);
    }
    GraphEdgeDto edge = subject.edge();
    return new BreachElement(
        BreachSubject.FLOW,
        edge.id(),
        index.label(edge.sourceId()) + " → " + index.label(edge.targetId()),
        edge.sourceId(),
        index.label(edge.sourceId()),
        edge.targetId(),
        index.label(edge.targetId()),
        tested);
  }

  /** One entry per distinct scope and attribute, in rule order. */
  private static List<BreachTestedValue> testedValues(
      Subject subject, BreachDefinition definition, GraphIndex index) {
    Map<String, BreachTestedValue> tested = new LinkedHashMap<>();
    for (BreachGroup group : definition.groups()) {
      for (BreachCondition condition : group.conditions()) {
        String key = condition.scope() + ":" + condition.attribute();
        if (tested.containsKey(key)) {
          continue;
        }
        Set<String> values = new LinkedHashSet<>();
        readings(condition, subject, index).forEach(values::addAll);
        tested.put(
            key, new BreachTestedValue(condition.scope(), condition.attribute(), List.copyOf(values)));
      }
    }
    return List.copyOf(tested.values());
  }

  /** Non-blank values of an application attribute: a flat property, else catalogue names. */
  private static List<String> nodeValues(GraphNodeDto node, String key) {
    if (node == null) {
      return List.of();
    }
    Object property = node.properties().get(key);
    if (property != null) {
      return values(property);
    }
    return values(node.nodeRefs().get(key));
  }

  private static List<String> edgeValues(GraphEdgeDto edge, String key) {
    return values(edge.properties().get(key));
  }

  private static List<String> values(Object raw) {
    if (raw == null) {
      return List.of();
    }
    Collection<?> items = raw instanceof Collection<?> collection ? collection : List.of(raw);
    return items.stream()
        .filter(item -> item != null)
        .map(item -> String.valueOf(item).trim())
        .filter(value -> !value.isEmpty())
        .toList();
  }

  /** The element a rule is evaluated for: an application or a flow. */
  private record Subject(GraphNodeDto node, GraphEdgeDto edge) {
    static Subject ofNode(GraphNodeDto node) {
      return new Subject(node, null);
    }

    static Subject ofEdge(GraphEdgeDto edge) {
      return new Subject(null, edge);
    }
  }

  /** Nodes by id and flows by endpoint, built once per evaluation. */
  private static final class GraphIndex {
    private final List<GraphNodeDto> nodes;
    private final List<GraphEdgeDto> edges;
    private final Map<String, GraphNodeDto> nodesById = new LinkedHashMap<>();
    private final Map<String, List<GraphEdgeDto>> outgoing = new LinkedHashMap<>();
    private final Map<String, List<GraphEdgeDto>> incoming = new LinkedHashMap<>();

    GraphIndex(GraphResponseDto graph) {
      nodes = graph.nodes() != null ? graph.nodes() : List.of();
      edges = graph.edges() != null ? graph.edges() : List.of();
      nodes.forEach(node -> nodesById.put(node.id(), node));
      for (GraphEdgeDto edge : edges) {
        outgoing.computeIfAbsent(edge.sourceId(), id -> new ArrayList<>()).add(edge);
        incoming.computeIfAbsent(edge.targetId(), id -> new ArrayList<>()).add(edge);
      }
    }

    List<GraphNodeDto> nodes() {
      return nodes;
    }

    List<GraphEdgeDto> edges() {
      return edges;
    }

    GraphNodeDto node(String id) {
      return nodesById.get(id);
    }

    String label(String id) {
      GraphNodeDto node = nodesById.get(id);
      return node != null ? node.label() : id;
    }

    List<GraphEdgeDto> outgoing(String id) {
      return outgoing.getOrDefault(id, List.of());
    }

    List<GraphEdgeDto> incoming(String id) {
      return incoming.getOrDefault(id, List.of());
    }

    List<GraphEdgeDto> incident(String id) {
      Set<GraphEdgeDto> all = new LinkedHashSet<>(outgoing(id));
      all.addAll(incoming(id));
      return List.copyOf(all);
    }
  }
}
