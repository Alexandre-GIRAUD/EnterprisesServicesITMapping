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

    @JsonProperty("edge_attributes")
    private Map<String, String> edgeAttributes = new LinkedHashMap<>();

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

    /** Trimmed keys and values; never null. */
    public Map<String, String> getEdgeAttributes() {
      if (edgeAttributes == null || edgeAttributes.isEmpty()) {
        return Map.of();
      }
      Map<String, String> out = new LinkedHashMap<>();
      for (Map.Entry<String, String> entry : edgeAttributes.entrySet()) {
        String key = entry.getKey() != null ? entry.getKey().trim() : "";
        String value = entry.getValue() != null ? entry.getValue().trim() : "";
        if (!key.isEmpty() && !value.isEmpty()) {
          out.put(key, value);
        }
      }
      return out;
    }

    public void setEdgeAttributes(Map<String, String> edgeAttributes) {
      this.edgeAttributes = edgeAttributes != null ? edgeAttributes : new LinkedHashMap<>();
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
