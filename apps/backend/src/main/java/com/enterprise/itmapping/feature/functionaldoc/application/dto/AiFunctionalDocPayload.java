package com.enterprise.itmapping.feature.functionaldoc.application.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.ArrayList;
import java.util.List;

/** JSON contract returned by the functional-documentation LLM agent. */
@JsonIgnoreProperties(ignoreUnknown = true)
public class AiFunctionalDocPayload {

  @JsonProperty("title")
  private String title;

  @JsonProperty("summary")
  private String summary;

  @JsonProperty("business_capabilities")
  private List<NamedDescription> businessCapabilities = new ArrayList<>();

  @JsonProperty("users_and_actors")
  private List<Actor> usersAndActors = new ArrayList<>();

  @JsonProperty("main_flows")
  private List<NamedDescription> mainFlows = new ArrayList<>();

  @JsonProperty("data_concepts")
  private List<NamedDescription> dataConcepts = new ArrayList<>();

  @JsonProperty("integrations_functional")
  private List<Integration> integrationsFunctional = new ArrayList<>();

  @JsonProperty("out_of_scope")
  private List<String> outOfScope = new ArrayList<>();

  @JsonProperty("assumptions")
  private List<String> assumptions = new ArrayList<>();

  @JsonProperty("limitations")
  private List<String> limitations = new ArrayList<>();

  @JsonProperty("sources")
  private List<String> sources = new ArrayList<>();

  public String getTitle() {
    return title != null ? title.trim() : "";
  }

  public void setTitle(String title) {
    this.title = title;
  }

  public String getSummary() {
    return summary != null ? summary.trim() : "";
  }

  public void setSummary(String summary) {
    this.summary = summary;
  }

  public List<NamedDescription> getBusinessCapabilities() {
    return businessCapabilities != null ? businessCapabilities : List.of();
  }

  public void setBusinessCapabilities(List<NamedDescription> businessCapabilities) {
    this.businessCapabilities = businessCapabilities != null ? businessCapabilities : new ArrayList<>();
  }

  public List<Actor> getUsersAndActors() {
    return usersAndActors != null ? usersAndActors : List.of();
  }

  public void setUsersAndActors(List<Actor> usersAndActors) {
    this.usersAndActors = usersAndActors != null ? usersAndActors : new ArrayList<>();
  }

  public List<NamedDescription> getMainFlows() {
    return mainFlows != null ? mainFlows : List.of();
  }

  public void setMainFlows(List<NamedDescription> mainFlows) {
    this.mainFlows = mainFlows != null ? mainFlows : new ArrayList<>();
  }

  public List<NamedDescription> getDataConcepts() {
    return dataConcepts != null ? dataConcepts : List.of();
  }

  public void setDataConcepts(List<NamedDescription> dataConcepts) {
    this.dataConcepts = dataConcepts != null ? dataConcepts : new ArrayList<>();
  }

  public List<Integration> getIntegrationsFunctional() {
    return integrationsFunctional != null ? integrationsFunctional : List.of();
  }

  public void setIntegrationsFunctional(List<Integration> integrationsFunctional) {
    this.integrationsFunctional =
        integrationsFunctional != null ? integrationsFunctional : new ArrayList<>();
  }

  public List<String> getOutOfScope() {
    return outOfScope != null ? outOfScope : List.of();
  }

  public void setOutOfScope(List<String> outOfScope) {
    this.outOfScope = outOfScope != null ? outOfScope : new ArrayList<>();
  }

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

  public List<String> getSources() {
    return sources != null ? sources : List.of();
  }

  public void setSources(List<String> sources) {
    this.sources = sources != null ? sources : new ArrayList<>();
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class NamedDescription {
    @JsonProperty("name")
    private String name;

    @JsonProperty("description")
    private String description;

    public String getName() {
      return name != null ? name.trim() : "";
    }

    public void setName(String name) {
      this.name = name;
    }

    public String getDescription() {
      return description != null ? description.trim() : "";
    }

    public void setDescription(String description) {
      this.description = description;
    }
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class Actor {
    @JsonProperty("name")
    private String name;

    @JsonProperty("role")
    private String role;

    public String getName() {
      return name != null ? name.trim() : "";
    }

    public void setName(String name) {
      this.name = name;
    }

    public String getRole() {
      return role != null ? role.trim() : "";
    }

    public void setRole(String role) {
      this.role = role;
    }
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class Integration {
    @JsonProperty("name")
    private String name;

    @JsonProperty("purpose")
    private String purpose;

    public String getName() {
      return name != null ? name.trim() : "";
    }

    public void setName(String name) {
      this.name = name;
    }

    public String getPurpose() {
      return purpose != null ? purpose.trim() : "";
    }

    public void setPurpose(String purpose) {
      this.purpose = purpose;
    }
  }
}
