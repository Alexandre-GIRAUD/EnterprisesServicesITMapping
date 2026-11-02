package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.applications.application.BusinessModelStore.ModuleLink;
import java.util.List;

/**
 * Partial update of an application business model. A null part is left alone, a blank text or
 * empty list clears it. The module links, when given, replace all existing links.
 */
public record BusinessModelPatch(
    List<String> businessObjects, List<ModuleLink> moduleLinks, String mainJourney, String scope) {}
