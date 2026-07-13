package com.enterprise.itmapping.feature.datamodel.presentation;

import com.enterprise.itmapping.feature.datamodel.application.DataModelService;
import com.enterprise.itmapping.feature.datamodel.presentation.dto.DataModelPromptPreviewResponse;
import com.enterprise.itmapping.feature.datamodel.presentation.dto.DataModelPutRequest;
import com.enterprise.itmapping.feature.datamodel.presentation.dto.DataModelResponse;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/data-model")
public class DataModelController {

  private final DataModelService dataModelService;

  public DataModelController(DataModelService dataModelService) {
    this.dataModelService = dataModelService;
  }

  @GetMapping
  public DataModelResponse get() {
    return dataModelService.get();
  }

  @GetMapping("/prompt-preview")
  public DataModelPromptPreviewResponse promptPreview() {
    return new DataModelPromptPreviewResponse(dataModelService.buildPromptSection());
  }

  @PutMapping
  @PreAuthorize("hasRole('ADMIN')")
  public DataModelResponse replace(@Valid @RequestBody DataModelPutRequest request) {
    return dataModelService.replace(request);
  }
}
