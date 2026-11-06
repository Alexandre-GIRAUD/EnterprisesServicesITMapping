package com.enterprise.itmapping.feature.workspace;

import com.enterprise.itmapping.feature.workspace.application.CurrentWorkspace;
import com.enterprise.itmapping.feature.workspace.domain.Workspaces;
import org.junit.jupiter.api.extension.AfterEachCallback;
import org.junit.jupiter.api.extension.BeforeEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;

/** Runs each test as a request of the Default workspace would, like a signed-in user of it. */
public class InDefaultWorkspace implements BeforeEachCallback, AfterEachCallback {

  private static final ExtensionContext.Namespace NAMESPACE =
      ExtensionContext.Namespace.create(InDefaultWorkspace.class);

  @Override
  public void beforeEach(ExtensionContext context) {
    context.getStore(NAMESPACE).put("binding", CurrentWorkspace.bind(Workspaces.DEFAULT_ID));
  }

  @Override
  public void afterEach(ExtensionContext context) {
    context.getStore(NAMESPACE).remove("binding", CurrentWorkspace.Binding.class).close();
  }
}
