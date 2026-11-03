package com.enterprise.itmapping.feature.referential.application;

import com.enterprise.itmapping.feature.referential.domain.ReferentialIdentity;
import com.enterprise.itmapping.feature.referential.domain.ReferentialMapping;
import com.enterprise.itmapping.feature.referential.domain.ReferentialSyncStatus;
import java.util.List;
import java.util.UUID;

/** Read models returned by the referential API. The secret is never one of these fields. */
public final class ReferentialResponses {

  private ReferentialResponses() {}

  public record View(
      UUID id,
      String name,
      String urlTemplate,
      String headerName,
      boolean secretConfigured,
      List<ReferentialIdentity> identities,
      List<ReferentialMapping> mappings,
      String samplePreview) {}

  public record ProbeResult(boolean success, String message, String samplePreview) {}

  public record FieldSync(String applicationId, String fieldKey, ReferentialSyncStatus status) {}

  public record SyncResult(List<FieldSync> results, List<String> errors) {}
}
