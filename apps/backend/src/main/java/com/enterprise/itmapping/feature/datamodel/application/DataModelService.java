package com.enterprise.itmapping.feature.datamodel.application;

import com.enterprise.itmapping.feature.auth.application.CurrentUserResolver;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.datamodel.infrastructure.persistence.DataModelEntity;
import com.enterprise.itmapping.feature.datamodel.infrastructure.persistence.DataModelRepository;
import com.enterprise.itmapping.feature.datamodel.presentation.dto.DataModelFieldDto;
import com.enterprise.itmapping.feature.datamodel.presentation.dto.DataModelPutRequest;
import com.enterprise.itmapping.feature.datamodel.presentation.dto.DataModelResponse;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DataModelService {

  private final DataModelRepository dataModelRepository;
  private final DataModelValidator validator;
  private final DataModelPromptBuilder promptBuilder;
  private final CurrentUserResolver currentUserResolver;

  public DataModelService(
      DataModelRepository dataModelRepository,
      DataModelValidator validator,
      DataModelPromptBuilder promptBuilder,
      CurrentUserResolver currentUserResolver) {
    this.dataModelRepository = dataModelRepository;
    this.validator = validator;
    this.promptBuilder = promptBuilder;
    this.currentUserResolver = currentUserResolver;
  }

  @Transactional(readOnly = true)
  public DataModelResponse get() {
    return toResponse(loadEntity());
  }

  @Transactional(readOnly = true)
  public DataModelConfig loadConfig() {
    return toConfig(loadEntity());
  }

  @Transactional(readOnly = true)
  public String buildPromptSection() {
    return promptBuilder.buildPromptSection(loadConfig());
  }

  @Transactional
  public DataModelResponse replace(DataModelPutRequest request) {
    List<DataModelField> fields =
        request.fields().stream().map(DataModelFieldDto::toDomain).toList();
    validator.validatePut(fields);
    DataModelConfig config = validator.normalize(fields);

    DataModelEntity entity = loadEntity();
    UserEntity user = currentUserResolver.requireCurrentUser();
    entity.setFields(config.fields());
    entity.setUpdatedBy(user);
    return toResponse(dataModelRepository.save(entity));
  }

  private DataModelEntity loadEntity() {
    return dataModelRepository
        .findById(DataModelEntity.DEFAULT_ID)
        .orElseGet(this::createDefault);
  }

  private DataModelEntity createDefault() {
    DataModelEntity entity = new DataModelEntity();
    entity.setFields(List.of());
    return dataModelRepository.save(entity);
  }

  private static DataModelConfig toConfig(DataModelEntity entity) {
    return new DataModelConfig(entity.getFields());
  }

  private static DataModelResponse toResponse(DataModelEntity entity) {
    List<DataModelFieldDto> fields =
        entity.getFields().stream().map(DataModelFieldDto::fromDomain).toList();
    return new DataModelResponse(fields, entity.getUpdatedAt());
  }
}
