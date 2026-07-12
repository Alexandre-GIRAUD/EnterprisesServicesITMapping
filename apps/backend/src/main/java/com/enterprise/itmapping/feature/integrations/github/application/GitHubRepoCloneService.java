package com.enterprise.itmapping.feature.integrations.github.application;

import com.enterprise.itmapping.feature.integrations.github.GitHubApiClient;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
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

  /**
   * Runs {@code git clone --depth 1} of {@code owner/repo} into a fresh temp directory.
   *
   * @return the workspace path containing the checked-out repository
   * @throws ResponseStatusException 502 when git is missing / clone fails / times out
   */
  public Path clone(String owner, String repo, int timeoutSeconds) {
    Path workspace;
    try {
      workspace = Files.createTempDirectory("module-discovery-");
    } catch (IOException e) {
      throw new ResponseStatusException(
          HttpStatus.INTERNAL_SERVER_ERROR, "Impossible de créer le workspace temporaire.", e);
    }

    String cloneUrl = buildCloneUrl(owner, repo);
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
                workspace.toString()));

    long startMs = System.currentTimeMillis();
    try {
      ProcessBuilder pb = new ProcessBuilder(command);
      pb.redirectErrorStream(true);
      // Avoid interactive credential prompts blocking the process on private/invalid repos.
      pb.environment().put("GIT_TERMINAL_PROMPT", "0");
      Process process = pb.start();

      String output = new String(process.getInputStream().readAllBytes());
      boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
      if (!finished) {
        process.destroyForcibly();
        deleteQuietly(workspace);
        throw new ResponseStatusException(
            HttpStatus.GATEWAY_TIMEOUT,
            "Clone du dépôt trop long (> " + timeoutSeconds + "s): " + owner + "/" + repo);
      }
      int exit = process.exitValue();
      if (exit != 0) {
        deleteQuietly(workspace);
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
          workspace);
      return workspace;
    } catch (IOException e) {
      deleteQuietly(workspace);
      throw new ResponseStatusException(
          HttpStatus.BAD_GATEWAY,
          "git introuvable ou clone impossible (git doit être installé sur le serveur).",
          e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      deleteQuietly(workspace);
      throw new ResponseStatusException(
          HttpStatus.BAD_GATEWAY, "Clone interrompu pour " + owner + "/" + repo, e);
    }
  }

  /**
   * Builds an HTTPS clone URL, injecting the GitHub token for private repos. The token is never
   * logged (only owner/repo are).
   */
  private String buildCloneUrl(String owner, String repo) {
    String host = "github.com";
    if (apiClient.hasToken()) {
      return "https://x-access-token:" + apiClient.token() + "@" + host + "/" + owner + "/" + repo + ".git";
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
