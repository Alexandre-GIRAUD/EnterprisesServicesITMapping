package com.enterprise.itmapping.feature.applications.application.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** JSON returned by the LLM (strict-ish contract). */
@JsonIgnoreProperties(ignoreUnknown = true)
public class AiModuleSuggestionPayload {

  @JsonProperty("modules")
  private List<AiModuleEntry> modules = new ArrayList<>();

  @JsonProperty("relationships")
  private List<AiRelationshipEntry> relationships = new ArrayList<>();

  public List<AiModuleEntry> getModules() {
    return modules != null ? modules : List.of();
  }

  public void setModules(List<AiModuleEntry> modules) {
    this.modules = modules != null ? modules : new ArrayList<>();
  }

  public List<AiRelationshipEntry> getRelationships() {
    return relationships != null ? relationships : List.of();
  }

  public void setRelationships(List<AiRelationshipEntry> relationships) {
    this.relationships = relationships != null ? relationships : new ArrayList<>();
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class AiModuleEntry {

    @JsonProperty("id")
    private String id;

    @JsonProperty("business_name")
    private String businessName;

    @JsonProperty("description_metier_breve")
    private String descriptionMetierBreve;

    public String getId() {
      String s = id != null ? id.trim() : "";
      return s.toLowerCase(Locale.ROOT);
    }

    public void setId(String id) {
      this.id = id;
    }

    public String getBusinessName() {
      return businessName != null ? businessName.trim() : "";
    }

    public void setBusinessName(String businessName) {
      this.businessName = businessName;
    }

    public String getDescriptionMetierBreve() {
      return descriptionMetierBreve != null ? descriptionMetierBreve.trim() : "";
    }

    public void setDescriptionMetierBreve(String descriptionMetierBreve) {
      this.descriptionMetierBreve = descriptionMetierBreve;
    }
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class AiRelationshipEntry {

    @JsonProperty("from_module_id")
    private String fromModuleId;

    @JsonProperty("to_module_id")
    private String toModuleId;

    @JsonProperty("relationship_kind")
    private String relationshipKind;

    @JsonProperty("business_rationale_one_liner")
    private String businessRationaleOneLiner;

    public String getFromModuleId() {
      String s = fromModuleId != null ? fromModuleId.trim() : "";
      return s.toLowerCase(Locale.ROOT);
    }

    public void setFromModuleId(String fromModuleId) {
      this.fromModuleId = fromModuleId;
    }

    public String getToModuleId() {
      String s = toModuleId != null ? toModuleId.trim() : "";
      return s.toLowerCase(Locale.ROOT);
    }

    public void setToModuleId(String toModuleId) {
      this.toModuleId = toModuleId;
    }

    public String getRelationshipKind() {
      return relationshipKind != null ? relationshipKind.trim() : "";
    }

    public void setRelationshipKind(String relationshipKind) {
      this.relationshipKind = relationshipKind;
    }

    public String getBusinessRationaleOneLiner() {
      return businessRationaleOneLiner != null ? businessRationaleOneLiner.trim() : "";
    }

    public void setBusinessRationaleOneLiner(String businessRationaleOneLiner) {
      this.businessRationaleOneLiner = businessRationaleOneLiner;
    }
  }
}
