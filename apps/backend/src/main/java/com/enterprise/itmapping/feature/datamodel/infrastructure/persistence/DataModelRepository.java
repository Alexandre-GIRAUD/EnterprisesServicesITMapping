package com.enterprise.itmapping.feature.datamodel.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DataModelRepository extends JpaRepository<DataModelEntity, String> {}
