package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.applications.application.dto.AiModuleSuggestionPayload;
import com.enterprise.itmapping.feature.integrations.llm.ModuleDiscoveryProperties;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Spring AI agent that explores a locally-cloned repository through {@link ModuleDiscoveryTools}
 * (grep / readFile / listTree / readReadme) and returns the discovered business modules. The
 * tool-calling ReAct loop is driven by Spring AI; this class only builds the prompt, attaches the
 * per-request tools and maps the final answer to {@link AiModuleSuggestionPayload}.
 */
@Component
public class ModuleDiscoveryAgent {

  private static final Logger log = LoggerFactory.getLogger(ModuleDiscoveryAgent.class);
  private static final String SYSTEM_PROMPT_LOCATION = "classpath:prompts/module-suggest-system.txt";

  private final ChatClient chatClient;
  private final ModuleDiscoveryProperties properties;
  private final String systemPrompt;

  public ModuleDiscoveryAgent(
      ChatClient moduleDiscoveryChatClient,
      ModuleDiscoveryProperties properties,
      ResourceLoader resourceLoader) {
    this.chatClient = moduleDiscoveryChatClient;
    this.properties = properties;
    this.systemPrompt = loadPrompt(resourceLoader);
  }

  /** Runs the agent against the given cloned workspace. */
  public DiscoveryResult discover(Path repoRoot, String owner, String repo) {
    ModuleDiscoveryTools tools =
        new ModuleDiscoveryTools(
            repoRoot,
            properties.maxGrepHits(),
            properties.maxReadCharsPerFile(),
            properties.maxTreeEntries());

    String userMessage =
        """
        Analyze the repository cloned locally for "%s/%s".

        Explore it with your tools before concluding:
        - Start with listTree("") and readReadme() to understand the layout.
        - Use grep to locate manifests (pom.xml, package.json, build.gradle, etc.),
          application entry points, domain packages and feature folders.
        - Use readFile on the most informative files (manifests, main modules, key domain classes).
        Be efficient: aim for at most %d tool calls in total.

        Then return the final JSON describing the business modules and their
        structural_contains relationships, following the required schema exactly.
        """
            .formatted(owner, repo, properties.maxToolIterations());

    log.info("Module discovery agent start repo={}/{}", owner, repo);
    AiModuleSuggestionPayload payload;
    try {
      payload =
          chatClient
              .prompt()
              .system(systemPrompt)
              .user(userMessage)
              .tools(tools)
              .call()
              .entity(AiModuleSuggestionPayload.class);
    } catch (ResponseStatusException e) {
      throw e;
    } catch (Exception e) {
      throw new ResponseStatusException(
          HttpStatus.BAD_GATEWAY, "Échec de l'agent LLM: " + e.getMessage(), e);
    }

    if (payload == null) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Réponse IA vide ou schéma illisible.");
    }

    List<String> analyzedFiles = tools.getAnalyzedFiles();
    log.info(
        "Module discovery agent done repo={}/{} modules={} relationships={} analyzedFiles={}",
        owner,
        repo,
        payload.getModules().size(),
        payload.getRelationships().size(),
        analyzedFiles.size());
    return new DiscoveryResult(payload, analyzedFiles, tools.getObservedFiles());
  }

  /** One scan over every repository folder of a grouped application. */
  public DiscoveryResult discoverAll(Path workspace, List<String> fullNames) {
    if (!MultiRepoPrompt.isGrouped(fullNames)) {
      String fullName = fullNames.get(0);
      int slash = fullName.indexOf('/');
      return discover(workspace, fullName.substring(0, slash), fullName.substring(slash + 1));
    }
    ModuleDiscoveryTools tools =
        new ModuleDiscoveryTools(
            workspace,
            properties.maxGrepHits(),
            properties.maxReadCharsPerFile(),
            properties.maxTreeEntries());
    int budget =
        MultiRepoPrompt.budget(
            properties.maxToolIterations(), fullNames.size(), MultiRepoPrompt.MODULE_CALL_CAP);
    String userMessage =
        """
        %s
        Explore every folder before concluding:
        - Start with listTree("") and then list each repository folder.
        - readFile the README inside each folder.
        - Use grep to locate manifests, entry points, domain packages and feature folders.
        Module ids must be unique. When two folders would use the same id, prefix that id with the folder name.
        Be efficient: aim for at most %d tool calls in total.

        Then return the final JSON describing the business modules and their
        structural_contains relationships, following the required schema exactly.
        """
            .formatted(MultiRepoPrompt.folderList(fullNames), budget);
    log.info("Module discovery agent start repos={}", fullNames);
    AiModuleSuggestionPayload payload;
    try {
      payload =
          chatClient
              .prompt()
              .system(systemPrompt)
              .user(userMessage)
              .tools(tools)
              .call()
              .entity(AiModuleSuggestionPayload.class);
    } catch (ResponseStatusException e) {
      throw e;
    } catch (Exception e) {
      throw new ResponseStatusException(
          HttpStatus.BAD_GATEWAY, "Échec de l'agent LLM: " + e.getMessage(), e);
    }
    if (payload == null) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Réponse IA vide ou schéma illisible.");
    }
    List<String> analyzedFiles = tools.getAnalyzedFiles();
    log.info(
        "Module discovery agent done repos={} modules={} analyzedFiles={}",
        fullNames,
        payload.getModules().size(),
        analyzedFiles.size());
    return new DiscoveryResult(payload, analyzedFiles, tools.getObservedFiles());
  }

  /**
   * Reads one stored document. There is no repository and no tool loop. {@code source_files} must be
   * verbatim excerpts of {@code documentBody}.
   */
  public DiscoveryResult discoverFromDocument(
      String sourceName, String documentTitle, String documentBody) {
    String userMessage =
        """
        Analyze the document "%s" for application "%s".
        This document is the only evidence. Do not use tools and do not invent file paths.
        Discover business modules that the document describes as parts of this application.
        Do not turn a product feature list into modules unless the text says those parts belong to this application.
        relationships use only structural_contains, and only when the document says a part sits inside another.
        source_files must be verbatim excerpts from the document (a sentence or short passage).

        Document:
        %s

        Then return ONLY the final JSON following the required schema exactly.
        """
            .formatted(documentTitle, sourceName, documentBody);
    log.info("Module discovery from document app={} title={}", sourceName, documentTitle);
    AiModuleSuggestionPayload payload;
    try {
      payload =
          chatClient
              .prompt()
              .system(systemPrompt)
              .user(userMessage)
              .call()
              .entity(AiModuleSuggestionPayload.class);
    } catch (ResponseStatusException e) {
      throw e;
    } catch (Exception e) {
      throw new ResponseStatusException(
          HttpStatus.BAD_GATEWAY, "Échec de l'agent LLM: " + e.getMessage(), e);
    }
    if (payload == null) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Réponse IA vide ou schéma illisible.");
    }
    return new DiscoveryResult(payload, List.of(documentTitle), List.of());
  }

  private static String loadPrompt(ResourceLoader resourceLoader) {
    Resource resource = resourceLoader.getResource(SYSTEM_PROMPT_LOCATION);
    if (!resource.exists()) {
      throw new IllegalStateException(SYSTEM_PROMPT_LOCATION + " manquant.");
    }
    try {
      return new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    } catch (IOException e) {
      throw new IllegalStateException("Impossible de lire " + SYSTEM_PROMPT_LOCATION, e);
    }
  }

  /** Agent output: parsed payload, files whose content was read, and files read or grepped. */
  public record DiscoveryResult(
      AiModuleSuggestionPayload payload, List<String> analyzedFiles, List<String> observedFiles) {

    public DiscoveryResult(AiModuleSuggestionPayload payload, List<String> analyzedFiles) {
      this(
          payload,
          analyzedFiles != null ? List.copyOf(analyzedFiles) : List.of(),
          analyzedFiles != null ? List.copyOf(analyzedFiles) : List.of());
    }
  }
}
