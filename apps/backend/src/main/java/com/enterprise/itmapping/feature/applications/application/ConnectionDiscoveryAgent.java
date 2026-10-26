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
   * @param dataModelPromptSection dynamic "## Active Data Model" section; blank when no fields are
   *     configured (topology-only mode).
   */
  public DiscoveryResult discover(
      Path repoRoot,
      String owner,
      String repo,
      String sourceName,
      String catalogText,
      String dataModelPromptSection) {
    ModuleDiscoveryTools tools =
        new ModuleDiscoveryTools(
            repoRoot,
            properties.maxGrepHits(),
            properties.maxReadCharsPerFile(),
            properties.maxTreeEntries());

    String userMessage =
        buildUserMessage(owner, repo, sourceName, catalogText, dataModelPromptSection);

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
    return new DiscoveryResult(payload, analyzedFiles, tools.getObservedFiles());
  }

  /** One scan over every repository folder of a grouped application. */
  public DiscoveryResult discoverAll(
      Path workspace,
      List<String> fullNames,
      String sourceName,
      String catalogText,
      String dataModelPromptSection) {
    if (!MultiRepoPrompt.isGrouped(fullNames)) {
      String fullName = fullNames.get(0);
      int slash = fullName.indexOf('/');
      return discover(
          workspace,
          fullName.substring(0, slash),
          fullName.substring(slash + 1),
          sourceName,
          catalogText,
          dataModelPromptSection);
    }
    ModuleDiscoveryTools tools =
        new ModuleDiscoveryTools(
            workspace,
            properties.maxGrepHits(),
            properties.maxReadCharsPerFile(),
            properties.maxTreeEntries());
    int budget =
        MultiRepoPrompt.budget(
            properties.maxToolIterations(), fullNames.size(), MultiRepoPrompt.CONNECTION_CALL_CAP);
    String userMessage =
        buildUserMessage(fullNames.get(0).substring(0, fullNames.get(0).indexOf('/')),
            fullNames.get(0).substring(fullNames.get(0).indexOf('/') + 1),
            sourceName,
            catalogText,
            dataModelPromptSection);
    userMessage =
        MultiRepoPrompt.folderList(fullNames)
            + "\n"
            + userMessage
            + "\nAim for at most "
            + budget
            + " tool calls in total across every repository folder.\n";
    log.info("Connection discovery agent start repos={} app={}", fullNames, sourceName);
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
        "Connection discovery agent done repos={} connections={} analyzedFiles={}",
        fullNames,
        payload.getConnections().size(),
        analyzedFiles.size());
    return new DiscoveryResult(payload, analyzedFiles, tools.getObservedFiles());
  }

  /**
   * Reads one stored document. There is no repository and no tool loop. {@code source_files} in the
   * answer must be verbatim excerpts of {@code documentBody}.
   */
  public DiscoveryResult discoverFromDocument(
      String sourceName,
      String documentTitle,
      String documentBody,
      String catalogText,
      String dataModelPromptSection) {
    String userMessage =
        buildDocumentUserMessage(
            sourceName, documentTitle, documentBody, catalogText, dataModelPromptSection);
    log.info("Connection discovery from document app={} title={}", sourceName, documentTitle);
    AiApplicationConnectionPayload payload;
    try {
      payload =
          chatClient.prompt().system(systemPrompt).user(userMessage).call().entity(AiApplicationConnectionPayload.class);
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

  private String buildDocumentUserMessage(
      String sourceName,
      String documentTitle,
      String documentBody,
      String catalogText,
      String dataModelPromptSection) {
    StringBuilder sb = new StringBuilder();
    sb.append(
        """
        Analyze the document "%s" for application "%s".
        This document is the only evidence. Do not use tools and do not invent file paths.
        Find OUTBOUND and INBOUND integration connections with the catalogue below.
        Match peer_application_name EXACTLY to one catalogue name; never invent applications.
        source_files and node_source_files must be verbatim excerpts from the document
        (a sentence or short passage copied from the text).

        Known IT applications (name | id):
        %s

        Document:
        %s
        """
            .formatted(documentTitle, sourceName, catalogText, documentBody));
    if (dataModelPromptSection != null && !dataModelPromptSection.isBlank()) {
      sb.append('\n').append(dataModelPromptSection.trim()).append('\n');
    }
    sb.append("\nThen return ONLY the final JSON following the required schema exactly.");
    return sb.toString();
  }

  private String buildUserMessage(
      String owner,
      String repo,
      String sourceName,
      String catalogText,
      String dataModelPromptSection) {
    StringBuilder sb = new StringBuilder();
    sb.append(
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
        """
            .formatted(owner, repo, sourceName, properties.maxToolIterations(), catalogText));

    if (dataModelPromptSection != null && !dataModelPromptSection.isBlank()) {
      sb.append('\n').append(dataModelPromptSection.trim()).append('\n');
    } else {
      sb.append(
          """

          (No automatic Data Model configured — discover integration topology only; do not populate
          edge_attributes or node_attributes.)
          """);
    }

    sb.append("\nThen return ONLY the final JSON following the required schema exactly.");
    return sb.toString();
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
      AiApplicationConnectionPayload payload,
      List<String> analyzedFiles,
      List<String> observedFiles) {

    public DiscoveryResult(AiApplicationConnectionPayload payload, List<String> analyzedFiles) {
      this(
          payload,
          analyzedFiles != null ? List.copyOf(analyzedFiles) : List.of(),
          analyzedFiles != null ? List.copyOf(analyzedFiles) : List.of());
    }
  }
}
