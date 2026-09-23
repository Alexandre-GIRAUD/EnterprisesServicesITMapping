package com.enterprise.itmapping.feature.functionaldoc.application;

import com.enterprise.itmapping.feature.applications.application.ModuleDiscoveryTools;
import com.enterprise.itmapping.feature.functionaldoc.application.dto.AiFunctionalDocPayload;
import com.enterprise.itmapping.feature.integrations.llm.FunctionalDocumentationProperties;
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
 * Spring AI agent that explores a cloned repository and returns structured functional
 * documentation (business/product view).
 */
@Component
public class FunctionalDocumentationAgent {

  private static final Logger log = LoggerFactory.getLogger(FunctionalDocumentationAgent.class);
  private static final String SYSTEM_PROMPT_LOCATION = "classpath:prompts/functional-doc-system.txt";

  private final ChatClient chatClient;
  private final FunctionalDocumentationProperties properties;
  private final String systemPrompt;

  public FunctionalDocumentationAgent(
      ChatClient moduleDiscoveryChatClient,
      FunctionalDocumentationProperties properties,
      ResourceLoader resourceLoader) {
    this.chatClient = moduleDiscoveryChatClient;
    this.properties = properties;
    this.systemPrompt = loadPrompt(resourceLoader);
  }

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
        - Start with readReadme() and listTree("").
        - Use grep/readFile on product docs, domain/feature folders and user-facing entry points.
        Be efficient: aim for at most %d tool calls in total.

        Then return the final JSON describing the functional documentation,
        following the required schema exactly. Write in English.
        """
            .formatted(owner, repo, properties.maxToolIterations());

    log.info("Functional documentation agent start repo={}/{}", owner, repo);
    AiFunctionalDocPayload payload;
    try {
      payload =
          chatClient
              .prompt()
              .system(systemPrompt)
              .user(userMessage)
              .tools(tools)
              .call()
              .entity(AiFunctionalDocPayload.class);
    } catch (ResponseStatusException e) {
      throw e;
    } catch (Exception e) {
      throw new ResponseStatusException(
          HttpStatus.BAD_GATEWAY, "Functional documentation agent failed: " + e.getMessage(), e);
    }

    if (payload == null || payload.getSummary().isBlank()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Empty or unreadable functional documentation response.");
    }

    List<String> analyzedFiles = tools.getAnalyzedFiles();
    log.info(
        "Functional documentation agent done repo={}/{} title={} analyzedFiles={}",
        owner,
        repo,
        payload.getTitle(),
        analyzedFiles.size());
    return new DiscoveryResult(payload, analyzedFiles);
  }

  private static String loadPrompt(ResourceLoader resourceLoader) {
    Resource resource = resourceLoader.getResource(SYSTEM_PROMPT_LOCATION);
    if (!resource.exists()) {
      throw new IllegalStateException(SYSTEM_PROMPT_LOCATION + " missing.");
    }
    try {
      return new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    } catch (IOException e) {
      throw new IllegalStateException("Unable to read " + SYSTEM_PROMPT_LOCATION, e);
    }
  }

  public record DiscoveryResult(AiFunctionalDocPayload payload, List<String> analyzedFiles) {}
}
