package com.enterprise.itmapping.feature.applications.application;

import java.util.List;

/** Prompt and tool budget shared by scans of an application that owns several repositories. */
public final class MultiRepoPrompt {

  public static final int MODULE_CALL_CAP = 60;
  public static final int CONNECTION_CALL_CAP = 80;
  public static final int DOCUMENTATION_CALL_CAP = 60;

  private MultiRepoPrompt() {}

  public static boolean isGrouped(List<String> fullNames) {
    return fullNames != null && fullNames.size() > 1;
  }

  public static int budget(int base, int repositoryCount, int cap) {
    int repositories = Math.max(repositoryCount, 1);
    long scaled = (long) base * repositories;
    return (int) Math.min(cap, scaled);
  }

  public static String folderList(List<String> fullNames) {
    StringBuilder text = new StringBuilder();
    text.append(
        "This application is made of several repositories. Each folder at the workspace root is one repository:\n");
    for (String fullName : fullNames) {
      int slash = fullName.lastIndexOf('/');
      String folder = slash >= 0 ? fullName.substring(slash + 1) : fullName;
      text.append("- ").append(folder).append(" (").append(fullName).append(")\n");
    }
    text.append(
        "They are one application. A call from one of these folders to another of these folders is internal and is not a flow to a different application.\n");
    return text.toString();
  }
}
