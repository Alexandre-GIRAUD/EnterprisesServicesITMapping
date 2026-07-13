package com.enterprise.itmapping.feature.datamodel.application;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.auth.application.CurrentUserResolver;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.datamodel.infrastructure.persistence.DataModelEntity;
import com.enterprise.itmapping.feature.datamodel.infrastructure.persistence.DataModelRepository;
import com.enterprise.itmapping.feature.datamodel.presentation.dto.DataModelFieldDto;
import com.enterprise.itmapping.feature.datamodel.presentation.dto.DataModelPutRequest;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class DataModelServiceTest {

  @Mock DataModelRepository dataModelRepository;
  @Mock DataModelValidator validator;
  @Mock DataModelPromptBuilder promptBuilder;
  @Mock CurrentUserResolver currentUserResolver;
  @Mock UserEntity user;

  @InjectMocks DataModelService dataModelService;

  @Test
  void replaceRejectsReservedKeyViaValidator() {
    DataModelPutRequest request =
        new DataModelPutRequest(
            List.of(
                new DataModelFieldDto(
                    "connection_kind", "Kind", "", "", List.of(), false, false)));

    org.mockito.Mockito.doThrow(
            new ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST, "Cle Data Model reservee: connection_kind"))
        .when(validator)
        .validatePut(any());

    assertThatThrownBy(() -> dataModelService.replace(request))
        .isInstanceOf(ResponseStatusException.class)
        .hasMessageContaining("reservee");
  }

  @Test
  void replacePersistsNormalizedFields() {
    DataModelFieldDto dto =
        new DataModelFieldDto(
            "product_line",
            "Ligne produit",
            "desc",
            "hint",
            List.of("X", "Y"),
            true,
            false);
    DataModelPutRequest request = new DataModelPutRequest(List.of(dto));

    DataModelEntity entity = new DataModelEntity();
    when(dataModelRepository.findById(DataModelEntity.DEFAULT_ID)).thenReturn(Optional.of(entity));
    when(currentUserResolver.requireCurrentUser()).thenReturn(user);
    when(validator.normalize(any()))
        .thenAnswer(
            inv ->
                new com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig(
                    List.of(dto.toDomain())));
    when(dataModelRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

    dataModelService.replace(request);

    verify(validator).validatePut(any());
    verify(dataModelRepository).save(entity);
  }
}
