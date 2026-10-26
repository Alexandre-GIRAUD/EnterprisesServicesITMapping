package com.enterprise.itmapping.feature.integrations.github.application;

import com.enterprise.itmapping.feature.integrations.github.GitHubApiClient;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * Shallow-clones a GitHub repository into a temporary workspace so the module-discovery agent can
 * explore it locally (grep / read / list). Callers are responsible for deleting the returned
 * workspace via {@link #deleteQuietly(Path)} in a {@code finally} block.
 */
@Service
public class GitHubRepoCloneService {

  private static final Logger log = LoggerFactory.getLogger(GitHubRepoCloneService.class);

  private final GitHubApiClient apiClient;

  public GitHubRepoCloneService(GitHubApiClient apiClient) {
    this.apiClient = apiClient;
  }

  /** Token resolved on the current thread. Capture it before an {@code @Async} hand-off. */
  public String currentAccessToken() {
    return apiClient.token();
  }

  public Path clone(String owner, String repo, int timeoutSeconds) {
    return clone(owner, repo, timeoutSeconds, apiClient.token());
  }

  public Path clone(String owner, String repo, int timeoutSeconds, String accessToken) {
    Path workspace = createWorkspace();
    try {
      cloneInto(workspace, owner, repo, timeoutSeconds, accessToken);
      return workspace;
    } catch (RuntimeException e) {
      deleteQuietly(workspace);
      throw e;
    }
  }

  /**
   * One repository is cloned at the workspace root. Several repositories each get a folder, so one
   * scan can read the whole application.
   */
  public Path cloneAll(List<String> fullNames, int timeoutSeconds) {
    return cloneAll(fullNames, timeoutSeconds, apiClient.token());
  }

  public Path cloneAll(List<String> fullNames, int timeoutSeconds, String accessToken) {
    if (fullNames == null || fullNames.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Depot GitHub manquant.");
    }
    if (fullNames.size() == 1) {
      String[] parts = ownerAndRepo(fullNames.get(0));
      return clone(parts[0], parts[1], timeoutSeconds, accessToken);
    }
    Path workspace = createWorkspace();
    Set<String> taken = new HashSet<>();
    try {
      for (String fullName : fullNames) {
        String[] parts = ownerAndRepo(fullName);
        Path destination = workspace.resolve(folderName(fullName, taken));
        cloneInto(destination, parts[0], parts[1], timeoutSeconds, accessToken);
      }
      return workspace;
    } catch (RuntimeException e) {
      deleteQuietly(workspace);
      throw e;
    }
  }

  static String folderName(String fullName, Set<String> taken) {
    int slash = fullName.lastIndexOf('/');
    String repo = slash >= 0 ? fullName.substring(slash + 1) : fullName;
    String folder = taken.contains(repo) ? fullName.replace('/', '-') : repo;
    taken.add(folder);
    return folder;
  }

  private Path createWorkspace() {
    try {
      return Files.createTempDirectory("module-discovery-");
    } catch (IOException e) {
      throw new ResponseStatusException(
          HttpStatus.INTERNAL_SERVER_ERROR, "Impossible de créer le workspace temporaire.", e);
    }
  }

  private void cloneInto(
      Path destination, String owner, String repo, int timeoutSeconds, String accessToken) {
    String cloneUrl = buildCloneUrl(owner, repo, accessToken);
    List<String> command =
        new ArrayList<>(
            List.of(
                "git",
                "clone",
                "--depth",
                "1",
                "--single-branch",
                "--no-tags",
                cloneUrl,
                destination.toString()));

    long startMs = System.currentTimeMillis();
    try {
      ProcessBuilder pb = new ProcessBuilder(command);
      pb.redirectErrorStream(true);
      pb.environment().put("GIT_TERMINAL_PROMPT", "0");
      Process process = pb.start();

      String output = new String(process.getInputStream().readAllBytes());
      boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
      if (!finished) {
        process.destroyForcibly();
        throw new ResponseStatusException(
            HttpStatus.GATEWAY_TIMEOUT,
            "Clone du dépôt trop long (> " + timeoutSeconds + "s): " + owner + "/" + repo);
      }
      int exit = process.exitValue();
      if (exit != 0) {
        log.warn("git clone failed repo={}/{} exit={} output={}", owner, repo, exit, output.trim());
        throw new ResponseStatusException(
            HttpStatus.BAD_GATEWAY,
            "Échec du clone GitHub pour " + owner + "/" + repo + " (git exit=" + exit + ").");
      }
      log.info(
          "Repo cloned repo={}/{} durationMs={} workspace={}",
          owner,
          repo,
          System.currentTimeMillis() - startMs,
          destination);
    } catch (IOException e) {
      throw new ResponseStatusException(
          HttpStatus.BAD_GATEWAY,
          "git introuvable ou clone impossible (git doit être installé sur le serveur).",
          e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new ResponseStatusException(
          HttpStatus.BAD_GATEWAY, "Clone interrompu pour " + owner + "/" + repo, e);
    }
  }

  private static String[] ownerAndRepo(String fullName) {
    int slash = fullName.indexOf('/');
    if (slash <= 0 || slash == fullName.length() - 1) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Depot GitHub invalide: " + fullName);
    }
    return new String[] {fullName.substring(0, slash), fullName.substring(slash + 1)};
  }

  /**
   * Builds an HTTPS clone URL, injecting the GitHub token for private repos. The token is never
   * logged (only owner/repo are).
   */
  private static String buildCloneUrl(String owner, String repo, String accessToken) {
    String host = "github.com";
    if (accessToken != null && !accessToken.isBlank()) {
      return "https://x-access-token:" + accessToken.trim() + "@" + host + "/" + owner + "/" + repo + ".git";
    }
    return "https://" + host + "/" + owner + "/" + repo + ".git";
  }

  /** Recursively deletes a workspace, swallowing IO errors (best-effort cleanup). */
  public void deleteQuietly(Path workspace) {
    if (workspace == null || !Files.exists(workspace)) {
      return;
    }
    try (var paths = Files.walk(workspace)) {
      paths.sorted(Comparator.reverseOrder()).forEach(GitHubRepoCloneService::deleteOne);
    } catch (IOException e) {
      log.warn("Failed to delete workspace {}: {}", workspace, e.getMessage());
    }
  }

  private static void deleteOne(Path path) {
    try {
      Files.deleteIfExists(path);
    } catch (IOException e) {
      log.warn("Failed to delete {}: {}", path, e.getMessage());
    }
  }
}
