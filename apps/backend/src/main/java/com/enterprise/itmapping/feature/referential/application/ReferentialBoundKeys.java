package com.enterprise.itmapping.feature.referential.application;

import com.enterprise.itmapping.feature.referential.domain.ReferentialMapping;
import com.enterprise.itmapping.feature.referential.infrastructure.persistence.ReferentialRepository;
import com.enterprise.itmapping.feature.referential.infrastructure.persistence.ReferentialSourceEntity;
import java.util.LinkedHashSet;
import java.util.Set;
import org.springframework.stereotype.Component;

/** NODE attribute keys that a referential fills, so code detection leaves them out of the prompt. */
@Component
public class ReferentialBoundKeys {

  private final ReferentialRepository repository;

  public ReferentialBoundKeys(ReferentialRepository repository) {
    this.repository = repository;
  }

  public Set<String> nodeAttributeKeys() {
    Set<String> keys = new LinkedHashSet<>();
    for (ReferentialSourceEntity entity : repository.findAll()) {
      for (ReferentialMapping mapping : entity.getMappings()) {
        if (mapping.fieldKey() != null) {
          keys.add(mapping.fieldKey());
        }
      }
    }
    return keys;
  }
}
