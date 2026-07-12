package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.integrations.github.GithubTreePathFilter;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.PathMatcher;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;

/**
 * Repository-exploration tools exposed to the Spring AI module-discovery agent. One instance is
 * created per suggestion request and bound to the local clone workspace; all tool methods operate on
 * that workspace only (never on the GitHub API). Paths are normalized and confined to the workspace
 * (no {@code ..} traversal). Tracks the files whose content was actually read so the caller can
 * report {@code analyzedFiles}.
 */
public class ModuleDiscoveryTools {

  private static final Logger log = LoggerFactory.getLogger(ModuleDiscoveryTools.class);
  private static final int MAX_LINE_LENGTH = 300;
  private static final int DEFAULT_TREE_DEPTH = 3;

  private final Path repoRoot;
  private final int maxGrepHits;
  private final int maxReadChars;
  private final int maxTreeEntries;
  private final Set<String> analyzedFiles = new LinkedHashSet<>();

  public ModuleDiscoveryTools(
      Path repoRoot, int maxGrepHits, int maxReadChars, int maxTreeEntries) {
    this.repoRoot = repoRoot.toAbsolutePath().normalize();
    this.maxGrepHits = maxGrepHits;
    this.maxReadChars = maxReadChars;
    this.maxTreeEntries = maxTreeEntries;
  }

  /** Paths (relative, POSIX) whose content was read via {@code readFile}/{@code readReadme}. */
  public List<String> getAnalyzedFiles() {
    return List.copyOf(analyzedFiles);
  }

  @Tool(
      description =
          "List files and folders under a directory of the cloned repository. Returns POSIX-style"
              + " relative paths (folders end with '/'). Use it to understand the project layout"
              + " before reading files. Noise like node_modules, build output and dotfiles is"
              + " filtered out.")
  public String listTree(
      @ToolParam(
              description =
                  "Directory relative to the repo root (empty string or '.' for the root).")
          String relativePath,
      @ToolParam(required = false, description = "Max recursion depth (default 3).") Integer maxDepth) {
    log.debug("tool listTree relativePath={} maxDepth={}", relativePath, maxDepth);
    Path base = resolveSafe(relativePath);
    if (!Files.isDirectory(base)) {
      return "Not a directory: " + toRelative(base);
    }
    int depth = maxDepth != null && maxDepth > 0 ? maxDepth : DEFAULT_TREE_DEPTH;
    List<String> entries = new ArrayList<>();
    try (Stream<Path> walk = Files.walk(base, depth)) {
      walk.filter(p -> !p.equals(base))
          .forEach(
              p -> {
                String rel = toRelative(p);
                if (rel.isEmpty() || GithubTreePathFilter.shouldExcludePath(rel, Integer.MAX_VALUE)) {
                  return;
                }
                entries.add(Files.isDirectory(p) ? rel + "/" : rel);
              });
    } catch (IOException e) {
      return "Error listing " + toRelative(base) + ": " + e.getMessage();
    }
    entries.sort(String::compareTo);
    boolean truncated = entries.size() > maxTreeEntries;
    List<String> capped = truncated ? entries.subList(0, maxTreeEntries) : entries;
    String body = String.join("\n", capped);
    return truncated ? body + "\n... (" + (entries.size() - maxTreeEntries) + " more entries)" : body;
  }

  @Tool(
      description =
          "Search file contents in the cloned repository with a regular expression (like grep/rg)."
              + " Returns matching lines as 'path:line: content'. Use it to locate manifests,"
              + " frameworks, endpoints, domain keywords, etc.")
  public String grep(
      @ToolParam(description = "Regular expression to search for.") String pattern,
      @ToolParam(
              required = false,
              description = "Optional glob to restrict files, e.g. '**/*.java' or 'pom.xml'.")
          String glob,
      @ToolParam(required = false, description = "Max matches to return (default 50).")
          Integer maxHits) {
    log.debug("tool grep pattern={} glob={} maxHits={}", pattern, glob, maxHits);
    if (pattern == null || pattern.isBlank()) {
      return "Empty pattern.";
    }
    int limit = maxHits != null && maxHits > 0 ? Math.min(maxHits, maxGrepHits) : maxGrepHits;
    List<String> hits = grepWithRipgrep(pattern, glob, limit);
    if (hits == null) {
      hits = grepWithJava(pattern, glob, limit);
    }
    if (hits.isEmpty()) {
      return "No matches.";
    }
    return String.join("\n", hits);
  }

  @Tool(
      description =
          "Read the UTF-8 text content of a file in the cloned repository. Content may be truncated."
              + " Binary files are refused.")
  public String readFile(
      @ToolParam(description = "File path relative to the repo root.") String relativePath,
      @ToolParam(required = false, description = "1-based first line to return (default 1).")
          Integer offset,
      @ToolParam(required = false, description = "Max number of lines to return.") Integer limit) {
    log.debug("tool readFile relativePath={} offset={} limit={}", relativePath, offset, limit);
    Path file = resolveSafe(relativePath);
    if (!Files.isRegularFile(file)) {
      return "Not a file: " + toRelative(file);
    }
    byte[] bytes;
    try {
      bytes = Files.readAllBytes(file);
    } catch (IOException e) {
      return "Error reading " + toRelative(file) + ": " + e.getMessage();
    }
    if (looksBinary(bytes)) {
      return "Binary file skipped: " + toRelative(file);
    }
    String content = new String(bytes, StandardCharsets.UTF_8);
    content = applyLineWindow(content, offset, limit);
    boolean truncated = content.length() > maxReadChars;
    if (truncated) {
      content = content.substring(0, maxReadChars);
    }
    analyzedFiles.add(toRelative(file));
    return truncated ? content + "\n... (truncated)" : content;
  }

  @Tool(
      description =
          "Read the root README of the cloned repository (README.md, README, etc.) if present."
              + " Returns an empty note when there is none.")
  public String readReadme() {
    log.debug("tool readReadme");
    try (Stream<Path> top = Files.list(repoRoot)) {
      Path readme =
          top.filter(Files::isRegularFile)
              .filter(p -> p.getFileName().toString().toLowerCase().startsWith("readme"))
              .sorted()
              .findFirst()
              .orElse(null);
      if (readme == null) {
        return "No root README found.";
      }
      return readFile(toRelative(readme), null, null);
    } catch (IOException e) {
      return "Error locating README: " + e.getMessage();
    }
  }

  // --- internals -------------------------------------------------------------

  private List<String> grepWithRipgrep(String pattern, String glob, int limit) {
    List<String> command = new ArrayList<>();
    command.add("rg");
    command.add("--line-number");
    command.add("--no-heading");
    command.add("--color=never");
    command.add("--max-columns=" + MAX_LINE_LENGTH);
    if (glob != null && !glob.isBlank()) {
      command.add("--glob");
      command.add(glob);
    }
    command.add("--regexp");
    command.add(pattern);
    command.add(".");
    try {
      ProcessBuilder pb = new ProcessBuilder(command);
      pb.directory(repoRoot.toFile());
      pb.redirectErrorStream(false);
      Process process = pb.start();
      List<String> hits = new ArrayList<>();
      try (var reader = process.inputReader(StandardCharsets.UTF_8)) {
        String line;
        while ((line = reader.readLine()) != null && hits.size() < limit) {
          hits.add(normalizeGrepLine(line));
        }
      }
      process.getInputStream().close();
      if (!process.waitFor(30, TimeUnit.SECONDS)) {
        process.destroyForcibly();
      }
      return hits;
    } catch (IOException e) {
      // rg not installed → signal fallback.
      return null;
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return null;
    }
  }

  private List<String> grepWithJava(String pattern, String glob, int limit) {
    Pattern regex;
    try {
      regex = Pattern.compile(pattern);
    } catch (PatternSyntaxException e) {
      return List.of("Invalid regex: " + e.getMessage());
    }
    PathMatcher matcher =
        (glob != null && !glob.isBlank())
            ? FileSystems.getDefault().getPathMatcher("glob:" + glob)
            : null;
    List<String> hits = new ArrayList<>();
    try (Stream<Path> walk = Files.walk(repoRoot)) {
      walk.filter(Files::isRegularFile)
          .filter(
              p -> {
                String rel = toRelative(p);
                return !rel.isEmpty()
                    && !GithubTreePathFilter.shouldExcludePath(rel, Integer.MAX_VALUE);
              })
          .filter(p -> matcher == null || matcher.matches(repoRoot.relativize(p)))
          .forEach(
              p -> {
                if (hits.size() >= limit) {
                  return;
                }
                grepFile(p, regex, hits, limit);
              });
    } catch (IOException e) {
      return List.of("Error during search: " + e.getMessage());
    } catch (UncheckedIOException e) {
      // ignore unreadable files reached during walk
    }
    return hits;
  }

  private void grepFile(Path file, Pattern regex, List<String> hits, int limit) {
    List<String> lines;
    try {
      byte[] bytes = Files.readAllBytes(file);
      if (looksBinary(bytes)) {
        return;
      }
      lines = List.of(new String(bytes, StandardCharsets.UTF_8).split("\n", -1));
    } catch (IOException e) {
      return;
    }
    String rel = toRelative(file);
    for (int i = 0; i < lines.size() && hits.size() < limit; i++) {
      if (regex.matcher(lines.get(i)).find()) {
        hits.add(rel + ":" + (i + 1) + ": " + truncateLine(lines.get(i)));
      }
    }
  }

  private String normalizeGrepLine(String line) {
    String normalized = line.replace('\\', '/');
    if (normalized.startsWith("./")) {
      normalized = normalized.substring(2);
    }
    return truncateLine(normalized);
  }

  private static String truncateLine(String line) {
    String trimmed = line.strip();
    return trimmed.length() > MAX_LINE_LENGTH
        ? trimmed.substring(0, MAX_LINE_LENGTH) + "…"
        : trimmed;
  }

  private static String applyLineWindow(String content, Integer offset, Integer limit) {
    if ((offset == null || offset <= 1) && limit == null) {
      return content;
    }
    String[] lines = content.split("\n", -1);
    int start = offset != null && offset > 1 ? offset - 1 : 0;
    if (start >= lines.length) {
      return "";
    }
    int end = limit != null && limit > 0 ? Math.min(lines.length, start + limit) : lines.length;
    return String.join("\n", List.of(lines).subList(start, end));
  }

  private static boolean looksBinary(byte[] bytes) {
    int sample = Math.min(bytes.length, 8000);
    for (int i = 0; i < sample; i++) {
      if (bytes[i] == 0) {
        return true;
      }
    }
    return false;
  }

  /** Resolves a caller-supplied relative path, confining it to the workspace (blocks traversal). */
  private Path resolveSafe(String relativePath) {
    String rel = GithubTreePathFilter.normalizePath(relativePath);
    Path target = repoRoot.resolve(rel).normalize();
    if (!target.startsWith(repoRoot)) {
      throw new IllegalArgumentException("Path escapes workspace: " + relativePath);
    }
    return target;
  }

  private String toRelative(Path path) {
    return repoRoot.relativize(path.toAbsolutePath().normalize()).toString().replace('\\', '/');
  }
}
