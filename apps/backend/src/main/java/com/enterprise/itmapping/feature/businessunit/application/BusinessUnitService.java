package com.enterprise.itmapping.feature.businessunit.application;

import com.enterprise.itmapping.domain.BusinessUnit;
import com.enterprise.itmapping.feature.businessunit.infrastructure.persistence.BusinessUnitRepository;
import com.enterprise.itmapping.feature.businessunit.presentation.dto.BusinessUnitCreateRequest;
import com.enterprise.itmapping.feature.businessunit.presentation.dto.BusinessUnitListItemDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BusinessUnitService {

  private final BusinessUnitRepository businessUnitRepository;

  public BusinessUnitService(BusinessUnitRepository businessUnitRepository) {
    this.businessUnitRepository = businessUnitRepository;
  }

  @Transactional
  public BusinessUnitListItemDto create(BusinessUnitCreateRequest request) {
    BusinessUnit bu = new BusinessUnit();
    bu.setName(request.name().trim());
    String code = request.code() != null ? request.code().trim() : "";
    bu.setCode(code.isEmpty() ? null : code);
    String desc = request.description() != null ? request.description().trim() : "";
    bu.setDescription(desc.isEmpty() ? null : desc);
    BusinessUnit saved = businessUnitRepository.save(bu);
    return new BusinessUnitListItemDto(saved.getId(), saved.getName());
  }
}
