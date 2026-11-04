package com.enterprise.itmapping.feature.breach.application;

import com.enterprise.itmapping.feature.changedetection.domain.ChangeDetectionItemKind;
import com.enterprise.itmapping.feature.graph.application.dto.GraphEdgeDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphNodeDto;
import com.enterprise.itmapping.feature.graph.application.dto.GraphResponseDto;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** A copy of the graph as it would be once a pending Change item is accepted. */
final class BreachGraphChange {

  static final String PROPOSED_FLOW_ID = "proposed-flow";
  static final String PROPOSED_PEER_ID = "proposed-peer";
  private static final String INBOUND = "inbound";

  private BreachGraphChange() {}

  static GraphResponseDto apply(
      GraphResponseDto graph,
      String applicationId,
      ChangeDetectionItemKind kind,
      Map<String, Object> payload) {
    return switch (kind) {
      case NODE_ATTRIBUTE -> withAttribute(graph, applicationId, payload);
      case CONNECTION -> withConnection(graph, applicationId, payload);
      case MODULE -> graph;
    };
  }

  private static GraphResponseDto withAttribute(
      GraphResponseDto graph, String applicationId, Map<String, Object> payload) {
    String key = text(payload.get("key"));
    if (key.isEmpty()) {
      return graph;
    }
    List<GraphNodeDto> nodes =
        graph.nodes().stream()
            .map(node -> node.id().equals(applicationId) ? withProperty(node, key, payload.get("value")) : node)
            .toList();
    return new GraphResponseDto(nodes, graph.edges());
  }

  private static GraphNodeDto withProperty(GraphNodeDto node, String key, Object value) {
    Map<String, Object> properties = new LinkedHashMap<>(node.properties());
    properties.put(key, text(value));
    return new GraphNodeDto(
        node.id(), node.label(), node.type(), node.description(), properties, node.nodeRefs());
  }

  /** Adds the proposed flow; a peer not on the map becomes an attribute-less application. */
  private static GraphResponseDto withConnection(
      GraphResponseDto graph, String applicationId, Map<String, Object> payload) {
    String peerName = text(payload.get("peerApplicationName"));
    List<GraphNodeDto> nodes = new ArrayList<>(graph.nodes());
    String peerId =
        findByName(graph.nodes(), peerName)
            .map(GraphNodeDto::id)
            .orElseGet(
                () -> {
                  nodes.add(new GraphNodeDto(PROPOSED_PEER_ID, peerName, "Application", null, Map.of()));
                  return PROPOSED_PEER_ID;
                });
    boolean inbound = INBOUND.equalsIgnoreCase(text(payload.get("direction")));
    List<GraphEdgeDto> edges = new ArrayList<>(graph.edges());
    edges.add(
        new GraphEdgeDto(
            PROPOSED_FLOW_ID,
            inbound ? peerId : applicationId,
            inbound ? applicationId : peerId,
            "DEPENDS_ON",
            null,
            edgeAttributes(payload.get("edgeAttributes"))));
    return new GraphResponseDto(nodes, edges);
  }

  private static Optional<GraphNodeDto> findByName(List<GraphNodeDto> nodes, String name) {
    return nodes.stream().filter(node -> node.label().equalsIgnoreCase(name)).findFirst();
  }

  private static Map<String, Object> edgeAttributes(Object raw) {
    Map<String, Object> attributes = new LinkedHashMap<>();
    if (raw instanceof Map<?, ?> map) {
      map.forEach(
          (key, value) -> {
            if (value != null) {
              attributes.put(String.valueOf(key), value);
            }
          });
    }
    return attributes;
  }

  private static String text(Object raw) {
    return raw == null ? "" : String.valueOf(raw).trim();
  }
}
