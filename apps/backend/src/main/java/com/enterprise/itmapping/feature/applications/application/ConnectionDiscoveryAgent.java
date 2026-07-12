package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.applications.application.dto.AiApplicationConnectionPayload;
import com.enterprise.itmapping.feature.integrations.llm.ConnectionDiscoveryProperties;
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
 * (grep / readFile / listTree / readReadme) and returns the discovered application-to-application
 * integration connections (outbound + inbound). The tool-calling ReAct loop is driven by Spring AI;
 * this class only builds the prompt, injects the application catalogue, attaches the per-request
 * tools, and maps the final answer to {@link AiApplicationConnectionPayload}.
 */
@Component
public class ConnectionDiscoveryAgent {

  private static final Logger log = LoggerFactory.getLogger(ConnectionDiscoveryAgent.class);
  private static final String SYSTEM_PROMPT_LOCATION =
      "classpath:prompts/connection-suggest-system.txt";

  private final ChatClient chatClient;
  private final ConnectionDiscoveryProperties properties;
  private final String systemPrompt;

  public ConnectionDiscoveryAgent(
      ChatClient moduleDiscoveryChatClient,
      ConnectionDiscoveryProperties properties,
      ResourceLoader resourceLoader) {
    this.chatClient = moduleDiscoveryChatClient;
    this.properties = properties;
    this.systemPrompt = loadPrompt(resourceLoader);
  }

  /**
   * Runs the agent against the given cloned workspace.
   *
   * @param catalogText compact catalogue of known applications ("name | id" per line), excluding the
   *     analyzed application itself.
   */
  public DiscoveryResult discover(
      Path repoRoot, String owner, String repo, String sourceName, String catalogText) {
    ModuleDiscoveryTools tools =
        new ModuleDiscoveryTools(
            repoRoot,
            properties.maxGrepHits(),
            properties.maxReadCharsPerFile(),
            properties.maxTreeEntries());

    String userMessage =
        """
        Analyze the repository cloned locally for "%s/%s" (application "%s").

        Find OUTBOUND and INBOUND integration connections between this application and the
        catalogue below. Match peer_application_name EXACTLY to one catalogue name; never invent
        applications outside the catalogue.

        Explore with your tools before concluding:
        - Start with readReadme() and listTree("") to understand the layout.
        - grep for integration patterns (kafka, rabbit, amqp, RestTemplate, WebClient,
          @FeignClient, @RestController, jdbc:, http(s)://, smb://, nfs, sftp) and for the
          catalogue application names.
        - readFile the most relevant configs/classes before concluding.
        Be efficient: aim for at most %d tool calls in total.

        Known IT applications (name | id):
        %s

        Then return ONLY the final JSON following the required schema exactly.
        """
            .formatted(
                owner, repo, sourceName, properties.maxToolIterations(), catalogText);

    log.info("Connection discovery agent start repo={}/{} app={}", owner, repo, sourceName);
    AiApplicationConnectionPayload payload;
    try {
      payload =
          chatClient
              .prompt()
              .system(systemPrompt)
              .user(userMessage)
              .tools(tools)
              .call()
              .entity(AiApplicationConnectionPayload.class);
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
        "Connection discovery agent done repo={}/{} connections={} analyzedFiles={}",
        owner,
        repo,
        payload.getConnections().size(),
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
  public record DiscoveryResult(
      AiApplicationConnectionPayload payload, List<String> analyzedFiles) {}
}
