package com.enterprise.itmapping.feature.breach.application;

import com.enterprise.itmapping.feature.breach.application.BreachElement.FlowEnds;
import com.enterprise.itmapping.feature.breach.domain.BreachCombinator;
import com.enterprise.itmapping.feature.breach.domain.BreachCondition;
import com.enterprise.itmapping.feature.breach.domain.BreachDefinition;
import com.enterprise.itmapping.feature.breach.domain.BreachGroup;
import com.enterprise.itmapping.feature.breach.domain.BreachNumber;
import com.enterprise.itmapping.feature.breach.domain.BreachOperator;
import com.enterprise.itmapping.feature.breach.domain.BreachRule;
import com.enterprise.itmapping.feature.breach.domain.BreachScope;
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
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import org.springframework.stereotype.Component;

/** Evaluates a breach rule over a graph, with three-valued logic (see the Breach spec). */
@Component
public class BreachEvaluator {

  public BreachResult evaluate(BreachRule rule, GraphResponseDto graph) {
    GraphIndex index = new GraphIndex(graph);
    List<BreachElement> breaches = new ArrayList<>();
    List<BreachElement> unknown = new ArrayList<>();
    for (Subject subject : listSubjects(rule.subject(), index)) {
      Truth truth = evaluateDefinition(rule.definition(), subject, index);
      if (truth == Truth.TRUE) {
        breaches.add(toElement(subject, rule.definition(), index));
      } else if (truth == Truth.UNKNOWN) {
        unknown.add(toElement(subject, rule.definition(), index));
      }
    }
    return new BreachResult(breaches, unknown);
  }

  private static List<Subject> listSubjects(BreachSubject kind, GraphIndex index) {
    if (kind == BreachSubject.APPLICATION) {
      return index.nodes().stream().map(Subject::ofNode).toList();
    }
    return index.edges().stream().map(Subject::ofEdge).toList();
  }

  private static Truth evaluateDefinition(BreachDefinition definition, Subject subject, GraphIndex index) {
    return fold(definition.combinator(), definition.groups(), group -> evaluateGroup(group, subject, index));
  }

  private static Truth evaluateGroup(BreachGroup group, Subject subject, GraphIndex index) {
    return fold(group.combinator(), group.conditions(), condition -> evaluateCondition(condition, subject, index));
  }

  private static <T> Truth fold(BreachCombinator combinator, List<T> items, Function<T, Truth> evaluate) {
    Truth result = combinator.identity();
    for (T item : items) {
      result = combinator.combine(result, evaluate.apply(item));
    }
    return result;
  }

  /** A scope that reads several elements (source or target, any flow) holds when one of them does. */
  private static Truth evaluateCondition(BreachCondition condition, Subject subject, GraphIndex index) {
    Truth result = Truth.FALSE;
    for (List<String> values : readValueLists(condition, subject, index)) {
      result = result.or(testValues(condition, values));
    }
    return result;
  }

  /** The value lists of every element the condition scope names, one list per element. */
  private static List<List<String>> readValueLists(BreachCondition condition, Subject subject, GraphIndex index) {
    String key = condition.attribute();
    return switch (condition.scope()) {
      case SELF -> List.of(readNodeValues(subject.node(), key));
      case ANY_FLOW_IN -> readEdgeValueLists(index.incoming(subject.node().id()), key);
      case ANY_FLOW_OUT -> readEdgeValueLists(index.outgoing(subject.node().id()), key);
      case ANY_FLOW -> readEdgeValueLists(index.incident(subject.node().id()), key);
      case FLOW -> List.of(readEdgeValues(subject.edge(), key));
      case SOURCE -> List.of(readNodeValues(index.node(subject.edge().sourceId()), key));
      case TARGET -> List.of(readNodeValues(index.node(subject.edge().targetId()), key));
      case SOURCE_OR_TARGET ->
          List.of(
              readNodeValues(index.node(subject.edge().sourceId()), key),
              readNodeValues(index.node(subject.edge().targetId()), key));
    };
  }

  private static List<List<String>> readEdgeValueLists(List<GraphEdgeDto> edges, String key) {
    return edges.stream().map(edge -> readEdgeValues(edge, key)).toList();
  }

  private static Truth testValues(BreachCondition condition, List<String> values) {
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
    return testTexts(operator, values, toLowerCase(condition.value()));
  }

  private static Truth testTexts(BreachOperator operator, List<String> values, String expected) {
    return switch (operator) {
      case EQUALS -> Truth.of(values.stream().anyMatch(value -> toLowerCase(value).equals(expected)));
      case NOT_EQUALS -> Truth.of(values.stream().noneMatch(value -> toLowerCase(value).equals(expected)));
      case CONTAINS -> Truth.of(values.stream().anyMatch(value -> toLowerCase(value).contains(expected)));
      default -> throw new IllegalStateException("Not a text operator: " + operator);
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

  private static String toLowerCase(String value) {
    return value.toLowerCase(Locale.ROOT);
  }

  private static BreachElement toElement(Subject subject, BreachDefinition definition, GraphIndex index) {
    List<BreachTestedValue> tested = collectTestedValues(subject, definition, index);
    if (subject.node() != null) {
      return BreachElement.ofApplication(subject.node().id(), subject.node().label(), tested);
    }
    GraphEdgeDto edge = subject.edge();
    FlowEnds ends = new FlowEnds(index.endpoint(edge.sourceId()), index.endpoint(edge.targetId()));
    return BreachElement.ofFlow(edge.id(), ends, tested);
  }

  /** One entry per distinct scope and attribute, in rule order. */
  private static List<BreachTestedValue> collectTestedValues(
      Subject subject, BreachDefinition definition, GraphIndex index) {
    Map<ScopedAttribute, BreachTestedValue> tested = new LinkedHashMap<>();
    definition.groups().stream()
        .flatMap(group -> group.conditions().stream())
        .forEach(
            condition ->
                tested.computeIfAbsent(
                    new ScopedAttribute(condition.scope(), condition.attribute()),
                    key -> readTestedValue(condition, subject, index)));
    return List.copyOf(tested.values());
  }

  private static BreachTestedValue readTestedValue(BreachCondition condition, Subject subject, GraphIndex index) {
    Set<String> values = new LinkedHashSet<>();
    readValueLists(condition, subject, index).forEach(values::addAll);
    return new BreachTestedValue(condition.scope(), condition.attribute(), List.copyOf(values));
  }

  /** Non-blank values of an application attribute: a flat property, else catalogue names. */
  private static List<String> readNodeValues(GraphNodeDto node, String key) {
    if (node == null) {
      return List.of();
    }
    Object property = node.properties().get(key);
    return toValueList(property != null ? property : node.nodeRefs().get(key));
  }

  private static List<String> readEdgeValues(GraphEdgeDto edge, String key) {
    return toValueList(edge.properties().get(key));
  }

  private static List<String> toValueList(Object raw) {
    if (raw == null) {
      return List.of();
    }
    Collection<?> items = raw instanceof Collection<?> collection ? collection : List.of(raw);
    return items.stream()
        .filter(Objects::nonNull)
        .map(item -> String.valueOf(item).trim())
        .filter(value -> !value.isEmpty())
        .toList();
  }

  private record ScopedAttribute(BreachScope scope, String attribute) {}

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

    /** An endpoint missing from the graph keeps its id as label. */
    BreachEndpoint endpoint(String id) {
      GraphNodeDto node = nodesById.get(id);
      return new BreachEndpoint(id, node != null ? node.label() : id);
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
