package com.enterprise.itmapping.feature.referential.application;

import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.referential.domain.ReferentialMapping;
import java.util.List;

/** Turns one stored sample into suggested field mappings. Sync never calls this. */
public interface ReferentialMappingProposer {

  List<ReferentialMapping> propose(String sampleBody, List<DataModelField> fields);
}
