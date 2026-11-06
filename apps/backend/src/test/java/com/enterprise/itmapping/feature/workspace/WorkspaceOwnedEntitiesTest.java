package com.enterprise.itmapping.feature.workspace;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.persistence.Entity;
import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.hibernate.annotations.TenantId;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;

/** A new table cannot silently escape workspace isolation: every entity carries a tenant id. */
class WorkspaceOwnedEntitiesTest {

  /** Tables read before any workspace is known: sign-in and the workspace list itself. */
  private static final Set<String> GLOBAL_ENTITIES = Set.of("UserEntity", "WorkspaceEntity");

  @Test
  void everyEntityExceptUsersAndWorkspacesHasATenantId() throws Exception {
    ClassPathScanningCandidateComponentProvider scanner =
        new ClassPathScanningCandidateComponentProvider(false);
    scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));

    List<String> missing = new java.util.ArrayList<>();
    for (BeanDefinition definition : scanner.findCandidateComponents("com.enterprise.itmapping")) {
      Class<?> type = Class.forName(definition.getBeanClassName());
      if (!GLOBAL_ENTITIES.contains(type.getSimpleName()) && !hasTenantId(type)) {
        missing.add(type.getSimpleName());
      }
    }

    assertThat(missing).isEmpty();
  }

  private static boolean hasTenantId(Class<?> type) {
    for (Class<?> c = type; c != null; c = c.getSuperclass()) {
      if (Arrays.stream(c.getDeclaredFields()).anyMatch(WorkspaceOwnedEntitiesTest::isTenantId)) {
        return true;
      }
    }
    return false;
  }

  private static boolean isTenantId(Field field) {
    return field.isAnnotationPresent(TenantId.class);
  }
}
