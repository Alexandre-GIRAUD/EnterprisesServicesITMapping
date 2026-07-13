package com.enterprise.itmapping.feature.datamodel.presentation.dto;

import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public record DataModelFieldDto(
    @NotBlank
        @Pattern(regexp = "[a-z][a-z0-9_]{1,63}")
        @Size(max = 64)
        String key,
    @NotBlank @Size(max = 120) String label,
    @Size(max = 500) String description,
    @Size(max = 500) String promptHint,
    List<@NotBlank @Size(max = 120) String> allowedValues,
    boolean enforceEnum,
    boolean required) {

  public DataModelField toDomain() {
    List<String> values =
        allowedValues != null
            ? allowedValues.stream().map(String::trim).filter(s -> !s.isEmpty()).distinct().toList()
            : List.of();
    return new DataModelField(
        key.trim(),
        label.trim(),
        description != null ? description.trim() : "",
        promptHint != null ? promptHint.trim() : "",
        values,
        enforceEnum,
        required);
  }

  public static DataModelFieldDto fromDomain(DataModelField field) {
    return new DataModelFieldDto(
        field.key(),
        field.label(),
        field.description(),
        field.promptHint(),
        field.allowedValues() != null ? List.copyOf(field.allowedValues()) : List.of(),
        field.enforceEnum(),
        field.required());
  }
}
