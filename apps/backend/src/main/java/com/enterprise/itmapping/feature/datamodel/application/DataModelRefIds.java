package com.enterprise.itmapping.feature.datamodel.application;

import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.util.StringUtils;

/** Stable ids and canonical values for {@code :DataModelRef} catalogue nodes. */
public final class DataModelRefIds {

  private static final Pattern NON_SLUG = Pattern.compile("[^a-z0-9]+");

  private DataModelRefIds() {}

  public static String canonicalValue(String raw) {
    return raw != null ? raw.trim() : "";
  }

  /**
   * Deterministic id from field key + canonical value so re-syncing the Data Model upserts the same
   * node (UUID name-based, version 3).
   */
  public static String stableId(String fieldKey, String canonicalValue) {
    String key = fieldKey != null ? fieldKey.trim().toLowerCase(Locale.ROOT) : "";
    String value = canonicalValue(canonicalValue);
    String slug = NON_SLUG.matcher(value.toLowerCase(Locale.ROOT)).replaceAll("_");
    if (!StringUtils.hasText(slug)) {
      slug = "value";
    }
    String seed = key + "\0" + value;
    return "ref_" + key + "_" + UUID.nameUUIDFromBytes(seed.getBytes(StandardCharsets.UTF_8));
  }

  public static String displayName(DataModelField field, String canonicalValue) {
    return canonicalValue(canonicalValue);
  }
}
