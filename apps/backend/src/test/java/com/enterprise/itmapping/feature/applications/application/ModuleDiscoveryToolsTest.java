package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ModuleDiscoveryToolsTest {

  @TempDir Path repo;
  private ModuleDiscoveryTools tools;

  @BeforeEach
  void setUp() throws IOException {
    Files.writeString(repo.resolve("README.md"), "# Billing Platform\nHandles invoices.");
    Files.writeString(repo.resolve("pom.xml"), "<project><artifactId>billing</artifactId></project>");
    Path domain = Files.createDirectories(repo.resolve("src/main/java/billing"));
    Files.writeString(domain.resolve("InvoiceService.java"), "class InvoiceService { void charge() {} }");
    Files.createDirectories(repo.resolve("node_modules/leftpad"));
    Files.writeString(repo.resolve("node_modules/leftpad/index.js"), "module.exports = 1;");
    Files.write(repo.resolve("logo.png"), new byte[] {0, 1, 2, 0, 3});

    tools = new ModuleDiscoveryTools(repo, 50, 12000, 500);
  }

  @Test
  void listTreeReturnsProjectPathsAndFiltersNoise() {
    String tree = tools.listTree("", 6);

    assertThat(tree).contains("pom.xml");
    assertThat(tree).contains("src/");
    assertThat(tree).contains("src/main/java/billing/InvoiceService.java");
    assertThat(tree).doesNotContain("node_modules");
  }

  @Test
  void listTreeRespectsDefaultDepth() {
    String tree = tools.listTree("", null);

    assertThat(tree).contains("pom.xml");
    assertThat(tree).contains("src/main/java/");
    assertThat(tree).doesNotContain("InvoiceService.java");
  }

  @Test
  void readFileReturnsContentAndTracksAnalyzedFile() {
    String content = tools.readFile("src/main/java/billing/InvoiceService.java", null, null);

    assertThat(content).contains("class InvoiceService");
    assertThat(tools.getAnalyzedFiles()).containsExactly("src/main/java/billing/InvoiceService.java");
  }

  @Test
  void readFileRefusesBinary() {
    String result = tools.readFile("logo.png", null, null);

    assertThat(result).startsWith("Binary file skipped");
    assertThat(tools.getAnalyzedFiles()).isEmpty();
  }

  @Test
  void readReadmeReturnsRootReadme() {
    String content = tools.readReadme();

    assertThat(content).contains("Billing Platform");
    assertThat(tools.getAnalyzedFiles()).contains("README.md");
  }

  @Test
  void grepFindsMatchesWithRelativePaths() {
    String hits = tools.grep("class InvoiceService", null, null);

    assertThat(hits).contains("InvoiceService.java");
    assertThat(hits).contains("class InvoiceService");
  }

  @Test
  void grepSupportsGlobFilter() {
    String hits = tools.grep("artifactId", "**/*.xml", null);

    assertThat(hits).contains("pom.xml");
  }

  @Test
  void readFileBlocksPathTraversal() {
    assertThatThrownBy(() -> tools.readFile("../outside.txt", null, null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("escapes workspace");
  }

  @Test
  void listTreeReportsMissingDirectory() {
    assertThat(tools.listTree("does/not/exist", null)).startsWith("Not a directory");
  }

  @Test
  void readFileWithLineWindow() throws IOException {
    Files.writeString(repo.resolve("multi.txt"), "l1\nl2\nl3\nl4\nl5", StandardCharsets.UTF_8);

    String content = tools.readFile("multi.txt", 2, 2);

    assertThat(content).isEqualTo("l2\nl3");
  }
}
