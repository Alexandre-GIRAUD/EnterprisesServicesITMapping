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

/**
 * Projects the graph as it would be once a pending Change item is accepted. It reads the payload
 * keys written by {@code DetectedChangeDrafts}, without touching the stored graph.
 */
final class BreachGraphChange {

  static final String PROPOSED_FLOW_ID = "proposed-flow";
  static final String PROPOSED_PEER_ID = "proposed-peer";

  private static final String APPLICATION_TYPE = "Application";
  private static final String FLOW_TYPE = "DEPENDS_ON";
  private static final String INBOUND = "inbound";
  private static final String ATTRIBUTE_KEY = "key";
  private static final String ATTRIBUTE_VALUE = "value";
  private static final String PEER_NAME = "peerApplicationName";
  private static final String DIRECTION = "direction";
  private static final String EDGE_ATTRIBUTES = "edgeAttributes";

  /** The run application and the item to apply to it. */
  record PendingChange(String applicationId, ChangeDetectionItemKind kind, Map<String, Object> payload) {}

  private BreachGraphChange() {}

  static GraphResponseDto apply(GraphResponseDto graph, PendingChange change) {
    return switch (change.kind()) {
      case NODE_ATTRIBUTE -> withAttribute(graph, change);
      case CONNECTION -> withConnection(graph, change);
      case MODULE -> graph;
    };
  }

  private static GraphResponseDto withAttribute(GraphResponseDto graph, PendingChange change) {
    String key = toText(change.payload().get(ATTRIBUTE_KEY));
    if (key.isEmpty()) {
      return graph;
    }
    String value = toText(change.payload().get(ATTRIBUTE_VALUE));
    List<GraphNodeDto> nodes =
        graph.nodes().stream()
            .map(node -> node.id().equals(change.applicationId()) ? withProperty(node, key, value) : node)
            .toList();
    return new GraphResponseDto(nodes, graph.edges());
  }

  private static GraphNodeDto withProperty(GraphNodeDto node, String key, String value) {
    Map<String, Object> properties = new LinkedHashMap<>(node.properties());
    properties.put(key, value);
    return new GraphNodeDto(node.id(), node.label(), node.type(), node.description(), properties, node.nodeRefs());
  }

  /** Adds the proposed flow; a peer not on the map becomes an attribute-less application. */
  private static GraphResponseDto withConnection(GraphResponseDto graph, PendingChange change) {
    String peerName = toText(change.payload().get(PEER_NAME));
    List<GraphNodeDto> nodes = new ArrayList<>(graph.nodes());
    Optional<GraphNodeDto> knownPeer = findByName(graph.nodes(), peerName);
    if (knownPeer.isEmpty()) {
      nodes.add(new GraphNodeDto(PROPOSED_PEER_ID, peerName, APPLICATION_TYPE, null, Map.of()));
    }
    String peerId = knownPeer.map(GraphNodeDto::id).orElse(PROPOSED_PEER_ID);
    boolean isInbound = INBOUND.equalsIgnoreCase(toText(change.payload().get(DIRECTION)));
    String sourceId = isInbound ? peerId : change.applicationId();
    String targetId = isInbound ? change.applicationId() : peerId;
    List<GraphEdgeDto> edges = new ArrayList<>(graph.edges());
    edges.add(
        new GraphEdgeDto(
            PROPOSED_FLOW_ID, sourceId, targetId, FLOW_TYPE, null, copyEdgeAttributes(change.payload())));
    return new GraphResponseDto(nodes, edges);
  }

  private static Optional<GraphNodeDto> findByName(List<GraphNodeDto> nodes, String name) {
    return nodes.stream().filter(node -> toText(node.label()).equalsIgnoreCase(name)).findFirst();
  }

  private static Map<String, Object> copyEdgeAttributes(Map<String, Object> payload) {
    Map<String, Object> attributes = new LinkedHashMap<>();
    if (payload.get(EDGE_ATTRIBUTES) instanceof Map<?, ?> map) {
      map.forEach(
          (key, value) -> {
            if (value != null) {
              attributes.put(String.valueOf(key), value);
            }
          });
    }
    return attributes;
  }

  private static String toText(Object raw) {
    return raw == null ? "" : String.valueOf(raw).trim();
  }
}
