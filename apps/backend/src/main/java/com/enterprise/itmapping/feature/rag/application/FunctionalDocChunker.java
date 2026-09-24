package com.enterprise.itmapping.feature.rag.application;

import com.enterprise.itmapping.feature.functionaldoc.application.dto.AiFunctionalDocPayload;
import com.enterprise.itmapping.feature.functionaldoc.application.dto.AiFunctionalDocPayload.Integration;
import com.enterprise.itmapping.feature.functionaldoc.application.dto.AiFunctionalDocPayload.NamedDescription;
import com.enterprise.itmapping.feature.integrations.llm.MappingRagProperties;
import com.enterprise.itmapping.feature.rag.domain.DocChunkDraft;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/** Splits a READY functional-doc payload (+ optional markdown) into embeddable chunks. */
@Component
public class FunctionalDocChunker {

  private final MappingRagProperties properties;

  public FunctionalDocChunker(MappingRagProperties properties) {
    this.properties = properties;
  }

  public List<DocChunkDraft> chunk(AiFunctionalDocPayload payload, String markdownCache) {
    List<DocChunkDraft> drafts = new ArrayList<>();
    if (payload != null) {
      String title = payload.getTitle();
      String summary = payload.getSummary();
      if (StringUtils.hasText(summary)) {
        String content =
            StringUtils.hasText(title) ? ("Title: " + title + "\n\n" + summary) : summary;
        add(drafts, "summary", title, 0, content);
      }
      int i = 0;
      for (NamedDescription item : payload.getBusinessCapabilities()) {
        addNamed(drafts, "capability", item, i++);
      }
      i = 0;
      for (NamedDescription item : payload.getMainFlows()) {
        addNamed(drafts, "flow", item, i++);
      }
      i = 0;
      for (NamedDescription item : payload.getDataConcepts()) {
        addNamed(drafts, "data_concept", item, i++);
      }
      i = 0;
      for (Integration item : payload.getIntegrationsFunctional()) {
        String name = item.getName();
        String purpose = item.getPurpose();
        String content =
            StringUtils.hasText(name) && StringUtils.hasText(purpose)
                ? name + ": " + purpose
                : (StringUtils.hasText(name) ? name : purpose);
        add(drafts, "integration", name, i++, content);
      }
    }
    if (StringUtils.hasText(markdownCache)) {
      addMarkdownChunks(drafts, markdownCache.trim());
    }

    int max = properties.maxChunksPerApp();
    if (drafts.size() > max) {
      return List.copyOf(drafts.subList(0, max));
    }
    return List.copyOf(drafts);
  }

  private void addNamed(
      List<DocChunkDraft> drafts, String sectionKey, NamedDescription item, int index) {
    if (item == null) {
      return;
    }
    String name = item.getName();
    String description = item.getDescription();
    String content =
        StringUtils.hasText(name) && StringUtils.hasText(description)
            ? name + ": " + description
            : (StringUtils.hasText(name) ? name : description);
    add(drafts, sectionKey, name, index, content);
  }

  private void addMarkdownChunks(List<DocChunkDraft> drafts, String markdown) {
    String[] sections = markdown.split("(?m)(?=^##\\s+)");
    int globalIndex = 0;
    int window = Math.max(200, properties.markdownWindowChars());
    int overlap = Math.max(0, Math.min(properties.markdownOverlapChars(), window / 2));
    for (String section : sections) {
      String trimmed = section.trim();
      if (!StringUtils.hasText(trimmed)) {
        continue;
      }
      String title = null;
      if (trimmed.startsWith("##")) {
        int nl = trimmed.indexOf('\n');
        title = (nl > 0 ? trimmed.substring(2, nl) : trimmed.substring(2)).trim();
      }
      if (trimmed.length() <= window) {
        add(drafts, "markdown", title, globalIndex++, trimmed);
        continue;
      }
      int start = 0;
      while (start < trimmed.length()) {
        int end = Math.min(trimmed.length(), start + window);
        add(drafts, "markdown", title, globalIndex++, trimmed.substring(start, end));
        if (end >= trimmed.length()) {
          break;
        }
        start = Math.max(start + 1, end - overlap);
      }
    }
  }

  private void add(
      List<DocChunkDraft> drafts, String sectionKey, String sectionTitle, int index, String raw) {
    if (!StringUtils.hasText(raw)) {
      return;
    }
    String content = raw.trim();
    if (content.length() < properties.minChunkChars()) {
      return;
    }
    if (content.length() > properties.maxChunkChars()) {
      content = content.substring(0, properties.maxChunkChars()) + "…";
    }
    drafts.add(
        new DocChunkDraft(
            sectionKey,
            StringUtils.hasText(sectionTitle) ? sectionTitle.trim() : null,
            index,
            content,
            sha256(content)));
  }

  static String sha256(String content) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(content.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(hash);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 unavailable", e);
    }
  }
}
