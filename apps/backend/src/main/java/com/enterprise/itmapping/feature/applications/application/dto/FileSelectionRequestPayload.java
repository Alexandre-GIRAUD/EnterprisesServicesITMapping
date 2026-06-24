package com.enterprise.itmapping.feature.applications.application.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.ArrayList;
import java.util.List;

/**
 * JSON returned by the LLM during the file-selection pass (Pass 1). The model lists repository
 * paths it wants to read and signals whether it has gathered enough context.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class FileSelectionRequestPayload {

  @JsonProperty("files_to_read")
  private List<String> filesToRead = new ArrayList<>();

  @JsonProperty("done")
  private boolean done;

  /** Never null; blank/null entries are dropped. */
  public List<String> getFilesToRead() {
    if (filesToRead == null) {
      return List.of();
    }
    List<String> cleaned = new ArrayList<>();
    for (String p : filesToRead) {
      if (p != null && !p.isBlank()) {
        cleaned.add(p.trim());
      }
    }
    return cleaned;
  }

  public void setFilesToRead(List<String> filesToRead) {
    this.filesToRead = filesToRead != null ? filesToRead : new ArrayList<>();
  }

  public boolean isDone() {
    return done;
  }

  public void setDone(boolean done) {
    this.done = done;
  }
}
