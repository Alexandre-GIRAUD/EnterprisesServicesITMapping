package com.enterprise.itmapping.feature.applications.application.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * JSON returned by the connection-discovery LLM agent (strict-ish contract). Describes the
 * integration connections discovered between the analyzed application and other applications of the
 * provided catalogue, both {@code outbound} and {@code inbound} (from the analyzed app's point of
 * view).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class AiApplicationConnectionPayload {

  @JsonProperty("assumptions")
  private List<String> assumptions = new ArrayList<>();

  @JsonProperty("limitations")
  private List<String> limitations = new ArrayList<>();

  @JsonProperty("connections")
  private List<AiConnectionEntry> connections = new ArrayList<>();

  /**
   * Business attributes for the analyzed Application (root-level, once per payload). Populated only
   * when the user message includes "## Active Data Model (application node enrichment)".
   */
  @JsonProperty("node_attributes")
  private Map<String, Object> nodeAttributes = new LinkedHashMap<>();

  /**
   * Catalogue classifications for the analyzed Application. Each key maps to a list of catalogue
   * value strings (or a single string, coerced to a one-element list).
   */
  @JsonProperty("node_refs")
  private Map<String, Object> nodeRefs = new LinkedHashMap<>();

  /** Repo-relative paths that supported node attributes and node refs for this run. */
  @JsonProperty("node_source_files")
  private List<String> nodeSourceFiles = new ArrayList<>();

  public List<String> getAssumptions() {
    return assumptions != null ? assumptions : List.of();
  }

  public void setAssumptions(List<String> assumptions) {
    this.assumptions = assumptions != null ? assumptions : new ArrayList<>();
  }

  public List<String> getLimitations() {
    return limitations != null ? limitations : List.of();
  }

  public void setLimitations(List<String> limitations) {
    this.limitations = limitations != null ? limitations : new ArrayList<>();
  }

  public List<AiConnectionEntry> getConnections() {
    return connections != null ? connections : List.of();
  }

  public void setConnections(List<AiConnectionEntry> connections) {
    this.connections = connections != null ? connections : new ArrayList<>();
  }

  /** Trimmed keys. A string stays a string. A JSON array stays a list. Never null. */
  public Map<String, Object> getNodeAttributes() {
    return normalizeAttributeMap(nodeAttributes);
  }

  public void setNodeAttributes(Map<String, ?> nodeAttributes) {
    this.nodeAttributes = copyAttributeMap(nodeAttributes);
  }

  /** Normalized key → catalogue values; never null. */
  public Map<String, List<String>> getNodeRefs() {
    if (nodeRefs == null || nodeRefs.isEmpty()) {
      return Map.of();
    }
    Map<String, List<String>> out = new LinkedHashMap<>();
    for (Map.Entry<String, Object> entry : nodeRefs.entrySet()) {
      String key = entry.getKey() != null ? entry.getKey().trim() : "";
      if (key.isEmpty()) {
        continue;
      }
      List<String> values = coerceStringList(entry.getValue());
      if (!values.isEmpty()) {
        out.put(key, values);
      }
    }
    return out;
  }

  public void setNodeRefs(Map<String, Object> nodeRefs) {
    this.nodeRefs = nodeRefs != null ? nodeRefs : new LinkedHashMap<>();
  }

  public List<String> getNodeSourceFiles() {
    return copyTrimmed(nodeSourceFiles);
  }

  public void setNodeSourceFiles(List<String> nodeSourceFiles) {
    this.nodeSourceFiles = nodeSourceFiles != null ? new ArrayList<>(nodeSourceFiles) : new ArrayList<>();
  }

  private static Map<String, Object> copyAttributeMap(Map<String, ?> raw) {
    Map<String, Object> copy = new LinkedHashMap<>();
    if (raw != null) {
      raw.forEach(copy::put);
    }
    return copy;
  }

  private static Map<String, Object> normalizeAttributeMap(Map<String, Object> raw) {
    if (raw == null || raw.isEmpty()) {
      return Map.of();
    }
    Map<String, Object> out = new LinkedHashMap<>();
    for (Map.Entry<String, Object> entry : raw.entrySet()) {
      String key = entry.getKey() != null ? entry.getKey().trim() : "";
      Object value = normalizeAttributeValue(entry.getValue());
      if (!key.isEmpty() && value != null) {
        out.put(key, value);
      }
    }
    return out;
  }

  private static Object normalizeAttributeValue(Object raw) {
    if (raw instanceof List<?> || raw instanceof java.util.Collection<?>) {
      List<String> values = coerceStringList(raw);
      return values.isEmpty() ? null : values;
    }
    if (raw == null) {
      return null;
    }
    String text = String.valueOf(raw).trim();
    return text.isEmpty() ? null : text;
  }

  private static List<String> copyTrimmed(List<String> raw) {
    if (raw == null || raw.isEmpty()) {
      return List.of();
    }
    List<String> out = new ArrayList<>();
    for (String item : raw) {
      if (item == null) {
        continue;
      }
      String trimmed = item.trim();
      if (!trimmed.isEmpty()) {
        out.add(trimmed);
      }
    }
    return List.copyOf(out);
  }

  private static List<String> coerceStringList(Object raw) {
    if (raw == null) {
      return List.of();
    }
    if (raw instanceof String s) {
      String t = s.trim();
      return t.isEmpty() ? List.of() : List.of(t);
    }
    if (raw instanceof List<?> list) {
      List<String> out = new ArrayList<>();
      for (Object item : list) {
        if (item == null) {
          continue;
        }
        String t = String.valueOf(item).trim();
        if (!t.isEmpty()) {
          out.add(t);
        }
      }
      return out;
    }
    String t = String.valueOf(raw).trim();
    return t.isEmpty() ? List.of() : List.of(t);
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class AiConnectionEntry {

    @JsonProperty("peer_application_name")
    private String peerApplicationName;

    @JsonProperty("direction")
    private String direction;

    @JsonProperty("connection_kind")
    private String connectionKind;

    @JsonProperty("channel")
    private String channel;

    @JsonProperty("confidence")
    private String confidence;

    @JsonProperty("business_rationale_one_liner")
    private String businessRationaleOneLiner;

    @JsonProperty("evidence_hint")
    private String evidenceHint;

    @JsonProperty("source_files")
    private List<String> sourceFiles = new ArrayList<>();

    @JsonProperty("edge_attributes")
    private Map<String, Object> edgeAttributes = new LinkedHashMap<>();

    public String getPeerApplicationName() {
      return peerApplicationName != null ? peerApplicationName.trim() : "";
    }

    public void setPeerApplicationName(String peerApplicationName) {
      this.peerApplicationName = peerApplicationName;
    }

    /** Normalized to lowercase; expected values {@code outbound} / {@code inbound}. */
    public String getDirection() {
      String s = direction != null ? direction.trim() : "";
      return s.toLowerCase(Locale.ROOT);
    }

    public void setDirection(String direction) {
      this.direction = direction;
    }

    /** Normalized to uppercase (e.g. {@code API}, {@code KAFKA}). */
    public String getConnectionKind() {
      String s = connectionKind != null ? connectionKind.trim() : "";
      return s.toUpperCase(Locale.ROOT);
    }

    public void setConnectionKind(String connectionKind) {
      this.connectionKind = connectionKind;
    }

    public String getChannel() {
      return channel != null ? channel.trim() : "";
    }

    public void setChannel(String channel) {
      this.channel = channel;
    }

    public String getConfidence() {
      String s = confidence != null ? confidence.trim() : "";
      return s.toLowerCase(Locale.ROOT);
    }

    public void setConfidence(String confidence) {
      this.confidence = confidence;
    }

    public String getBusinessRationaleOneLiner() {
      return businessRationaleOneLiner != null ? businessRationaleOneLiner.trim() : "";
    }

    public void setBusinessRationaleOneLiner(String businessRationaleOneLiner) {
      this.businessRationaleOneLiner = businessRationaleOneLiner;
    }

    public String getEvidenceHint() {
      return evidenceHint != null ? evidenceHint.trim() : "";
    }

    public void setEvidenceHint(String evidenceHint) {
      this.evidenceHint = evidenceHint;
    }

    /**
     * Paths cited for this connection. {@code source_files} wins. A single relative {@code
     * evidence_hint} is kept when that list is empty.
     */
    public List<String> citedSourceFiles() {
      List<String> cited = copyTrimmed(sourceFiles);
      if (!cited.isEmpty()) {
        return cited;
      }
      String hint = getEvidenceHint();
      if (hint.isEmpty() || hint.indexOf(' ') >= 0 || hint.indexOf('\n') >= 0) {
        return List.of();
      }
      return List.of(hint);
    }

    public void setSourceFiles(List<String> sourceFiles) {
      this.sourceFiles = sourceFiles != null ? new ArrayList<>(sourceFiles) : new ArrayList<>();
    }

    /** Trimmed keys. A string stays a string. A JSON array stays a list. Never null. */
    public Map<String, Object> getEdgeAttributes() {
      return normalizeAttributeMap(edgeAttributes);
    }

    public void setEdgeAttributes(Map<String, ?> edgeAttributes) {
      this.edgeAttributes = copyAttributeMap(edgeAttributes);
    }

    @Override
    public String toString() {
      return getDirection()
          + " "
          + getConnectionKind()
          + " -> "
          + getPeerApplicationName()
          + (getChannel().isEmpty() ? "" : " (" + getChannel() + ")");
    }
  }
}
