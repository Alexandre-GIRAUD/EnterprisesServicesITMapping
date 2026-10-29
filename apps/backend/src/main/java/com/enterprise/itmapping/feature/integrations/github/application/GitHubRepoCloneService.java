package com.enterprise.itmapping.feature.integrations.github.application;

import com.enterprise.itmapping.feature.integrations.bitbucket.BitbucketApiClient;
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
import org.springframework.beans.factory.annotation.Autowired;
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

  private static final String GITHUB_HOST = "github.com";
  private static final String GITHUB_TOKEN_USER = "x-access-token";
  static final String BITBUCKET_HOST = "bitbucket.org";
  static final String BITBUCKET_TOKEN_USER = "x-bitbucket-api-token-auth";

  private final GitHubApiClient apiClient;
  private final BitbucketApiClient bitbucketApiClient;

  public GitHubRepoCloneService(GitHubApiClient apiClient) {
    this(apiClient, null);
  }

  @Autowired
  public GitHubRepoCloneService(GitHubApiClient apiClient, BitbucketApiClient bitbucketApiClient) {
    this.apiClient = apiClient;
    this.bitbucketApiClient = bitbucketApiClient;
  }

  /** Token resolved on the current thread. Capture it before an {@code @Async} hand-off. */
  public String currentAccessToken() {
    return accessToken(false);
  }

  /** GitHub token, or the Bitbucket token when {@code bitbucket} is true. */
  public String accessToken(boolean bitbucket) {
    if (!bitbucket) {
      return apiClient.token();
    }
    return bitbucketApiClient == null ? "" : bitbucketApiClient.token();
  }

  public Path clone(String owner, String repo, int timeoutSeconds) {
    return clone(owner, repo, timeoutSeconds, false);
  }

  public Path clone(String owner, String repo, int timeoutSeconds, boolean bitbucket) {
    return clone(owner, repo, timeoutSeconds, accessToken(bitbucket), bitbucket);
  }

  public Path clone(String owner, String repo, int timeoutSeconds, String accessToken) {
    return clone(owner, repo, timeoutSeconds, accessToken, false);
  }

  public Path clone(String owner, String repo, int timeoutSeconds, String accessToken, boolean bitbucket) {
    Path workspace = createWorkspace();
    try {
      cloneInto(workspace, owner, repo, timeoutSeconds, accessToken, bitbucket);
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
    return cloneAll(fullNames, timeoutSeconds, apiClient.token(), false);
  }

  public Path cloneAll(List<String> fullNames, int timeoutSeconds, String accessToken) {
    return cloneAll(fullNames, timeoutSeconds, accessToken, false);
  }

  public Path cloneAll(List<String> fullNames, int timeoutSeconds, String accessToken, boolean bitbucket) {
    if (fullNames == null || fullNames.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Depot manquant.");
    }
    if (fullNames.size() == 1) {
      String[] parts = ownerAndRepo(fullNames.get(0));
      return clone(parts[0], parts[1], timeoutSeconds, accessToken, bitbucket);
    }
    Path workspace = createWorkspace();
    Set<String> taken = new HashSet<>();
    try {
      for (String fullName : fullNames) {
        String[] parts = ownerAndRepo(fullName);
        Path destination = workspace.resolve(folderName(fullName, taken));
        cloneInto(destination, parts[0], parts[1], timeoutSeconds, accessToken, bitbucket);
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
      Path destination, String owner, String repo, int timeoutSeconds, String accessToken, boolean bitbucket) {
    String cloneUrl = buildCloneUrl(owner, repo, accessToken, bitbucket);
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
  static String buildCloneUrl(String owner, String repo, String accessToken, boolean bitbucket) {
    String host = bitbucket ? BITBUCKET_HOST : GITHUB_HOST;
    String tokenUser = bitbucket ? BITBUCKET_TOKEN_USER : GITHUB_TOKEN_USER;
    if (accessToken != null && !accessToken.isBlank()) {
      return "https://" + tokenUser + ":" + accessToken.trim() + "@" + host + "/" + owner + "/" + repo + ".git";
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
