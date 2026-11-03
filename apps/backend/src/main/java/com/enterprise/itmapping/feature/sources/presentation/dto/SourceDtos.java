package com.enterprise.itmapping.feature.sources.presentation.dto;

import com.enterprise.itmapping.feature.sources.domain.SourceAuthType;
import com.enterprise.itmapping.feature.sources.domain.SourceKind;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;

/** Request and response shapes of the data sources API. */
public final class SourceDtos {

  private SourceDtos() {}

  /** Blank {@code secret} on update keeps the stored secret. */
  public record SourceRequest(
      @NotBlank @Size(max = 120) String name,
      @NotNull SourceKind kind,
      @NotBlank @Size(max = 1000) String endpoint,
      @Size(max = 200) String toolName,
      @Size(max = 200) String itemsPath,
      SourceAuthType authType,
      @Size(max = 120) @Pattern(regexp = "[A-Za-z0-9-]*") String authHeaderName,
      @Size(max = 200) String authUsername,
      @Size(max = 2000) String secret,
      @Size(max = 200) String keyColumn,
      Map<String, @Size(max = 200) String> columnMap) {}

  /** The secret itself is never returned, only whether one is stored. */
  public record SourceResponse(
      String id,
      String name,
      SourceKind kind,
      String endpoint,
      String toolName,
      String itemsPath,
      SourceAuthType authType,
      String authHeaderName,
      String authUsername,
      boolean secretSet,
      String keyColumn,
      Map<String, String> columnMap) {}

  public record SourcePreviewResponse(List<String> columns, int rowCount) {}

  public record ApplicationRef(String id, String name) {}

  public record MappingEntryDto(@NotBlank String applicationId, String sourceKey, boolean noMatch) {}

  public record MappingPutRequest(@NotNull @Valid List<MappingEntryDto> entries) {}

  public record MappingResponse(
      List<String> sourceKeys,
      List<ApplicationRef> applications,
      List<MappingEntryDto> entries,
      Map<String, String> suggestions) {}

  public record SyncResponse(
      int updatedApplications,
      int failedApplications,
      int missingKeyApplications,
      List<String> fieldsWithoutColumn) {}

  /** What every user may see of a source. */
  public record SourceNameDto(String id, String name, SourceKind kind) {}

  public record MappingAlertDto(
      String sourceId, String sourceName, List<ApplicationRef> applications) {}
}
