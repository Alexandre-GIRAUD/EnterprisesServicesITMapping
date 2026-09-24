package com.enterprise.itmapping.feature.chat.application;

import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery;
import com.enterprise.itmapping.feature.applications.application.ApplicationService;
import com.enterprise.itmapping.feature.applications.application.ModuleGraphService;
import com.enterprise.itmapping.feature.chat.presentation.dto.ChatAskRequest;
import com.enterprise.itmapping.feature.chat.presentation.dto.ChatAskResponse;
import com.enterprise.itmapping.feature.functionaldoc.application.FunctionalDocumentationService;
import com.enterprise.itmapping.feature.graph.application.GraphNeighborhoodService;
import com.enterprise.itmapping.feature.integrations.llm.MappingChatProperties;
import com.enterprise.itmapping.feature.rag.application.FunctionalDocSearchService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MappingChatService {

  private final MappingChatAgent agent;
  private final MappingChatProperties properties;
  private final ApplicationCatalogQuery catalogQuery;
  private final GraphNeighborhoodService neighborhoodService;
  private final ApplicationService applicationService;
  private final FunctionalDocumentationService documentationService;
  private final ModuleGraphService moduleGraphService;
  private final FunctionalDocSearchService docSearchService;
  private final ObjectMapper objectMapper;
  private final String openAiApiKey;

  public MappingChatService(
      MappingChatAgent agent,
      MappingChatProperties properties,
      ApplicationCatalogQuery catalogQuery,
      GraphNeighborhoodService neighborhoodService,
      ApplicationService applicationService,
      FunctionalDocumentationService documentationService,
      ModuleGraphService moduleGraphService,
      FunctionalDocSearchService docSearchService,
      ObjectMapper objectMapper,
      @Value("${spring.ai.openai.api-key:}") String openAiApiKey) {
    this.agent = agent;
    this.properties = properties;
    this.catalogQuery = catalogQuery;
    this.neighborhoodService = neighborhoodService;
    this.applicationService = applicationService;
    this.documentationService = documentationService;
    this.moduleGraphService = moduleGraphService;
    this.docSearchService = docSearchService;
    this.objectMapper = objectMapper;
    this.openAiApiKey = openAiApiKey;
  }

  public ChatAskResponse ask(ChatAskRequest request) {
    if (!properties.enabled()) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Mapping chat is disabled.");
    }
    if (!StringUtils.hasText(openAiApiKey)
        || openAiApiKey.isBlank()
        || openAiApiKey.startsWith("${")) {
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE, "LLM is not configured (OPENAI_API_KEY).");
    }
    if (request == null || !StringUtils.hasText(request.message())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "message is required.");
    }

    MappingChatTools tools =
        new MappingChatTools(
            catalogQuery,
            neighborhoodService,
            applicationService,
            documentationService,
            moduleGraphService,
            docSearchService,
            properties,
            objectMapper);

    String answer = agent.ask(request.message().trim(), request.messages(), tools);
    if (!StringUtils.hasText(answer)) {
      answer = "Je n'ai pas pu produire de réponse. Réessayez ou reformulez la question.";
    }
    return new ChatAskResponse(answer.trim(), tools.citations(), tools.warnings());
  }
}
