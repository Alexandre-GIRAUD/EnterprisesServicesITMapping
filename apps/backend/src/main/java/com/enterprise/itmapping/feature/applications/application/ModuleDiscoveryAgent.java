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
    return new DiscoveryResult(payload, analyzedFiles);
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

  /** Agent output: the parsed payload plus the files whose content was actually read. */
  public record DiscoveryResult(AiModuleSuggestionPayload payload, List<String> analyzedFiles) {}
}
