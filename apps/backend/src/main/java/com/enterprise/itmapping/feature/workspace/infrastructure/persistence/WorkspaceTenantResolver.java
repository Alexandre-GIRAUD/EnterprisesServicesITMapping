package com.enterprise.itmapping.feature.workspace.infrastructure.persistence;

import com.enterprise.itmapping.feature.workspace.application.CurrentWorkspace;
import java.util.Map;
import java.util.UUID;
import org.hibernate.cfg.AvailableSettings;
import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.stereotype.Component;

/** Hands Hibernate the current workspace as tenant for every session it opens. */
@Component
public class WorkspaceTenantResolver
    implements CurrentTenantIdentifierResolver<UUID>, HibernatePropertiesCustomizer {

  /**
   * Used when nothing is bound (sign-in, startup). No workspace has this id, so tenant reads come
   * back empty and tenant writes fail on the foreign key.
   */
  static final UUID NO_WORKSPACE = new UUID(0L, 0L);

  @Override
  public UUID resolveCurrentTenantIdentifier() {
    return CurrentWorkspace.find().orElse(NO_WORKSPACE);
  }

  @Override
  public boolean validateExistingCurrentSessions() {
    return false;
  }

  @Override
  public void customize(Map<String, Object> hibernateProperties) {
    hibernateProperties.put(AvailableSettings.MULTI_TENANT_IDENTIFIER_RESOLVER, this);
  }
}
