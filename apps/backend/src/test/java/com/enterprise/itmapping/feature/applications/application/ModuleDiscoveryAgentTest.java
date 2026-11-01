package com.enterprise.itmapping.feature.applications.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.applications.application.dto.AiModuleSuggestionPayload;
import com.enterprise.itmapping.feature.integrations.llm.ModuleDiscoveryProperties;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.core.io.DefaultResourceLoader;

class ModuleDiscoveryAgentTest {

  @TempDir Path workspace;

  @Test
  void promptNamesTheModuleToKeepAndTheLayersToDrop() throws Exception {
    String prompt =
        new String(
            new DefaultResourceLoader()
                .getResource("classpath:prompts/module-suggest-system.txt")
                .getInputStream()
                .readAllBytes(),
            StandardCharsets.UTF_8);

    assertThat(prompt).contains("payments");
    assertThat(prompt).contains("dto");
  }

  @Test
  void singleRepositoryMessageStartsWithTheTree() throws Exception {
    Files.createDirectories(workspace.resolve("payment"));
    Files.writeString(workspace.resolve("payment/README.md"), "collection");
    ChatClient.ChatClientRequestSpec request = requestSpec();
    ModuleDiscoveryAgent agent = agent(request);

    agent.discover(workspace, "acme", "billing");

    assertThat(capturedUserMessage(request)).contains("payment/README.md");
  }

  @Test
  void groupedRepositoryMessageStartsWithTheTree() throws Exception {
    Files.createDirectories(workspace.resolve("billing"));
    Files.writeString(workspace.resolve("billing/pom.xml"), "<project/>");
    ChatClient.ChatClientRequestSpec request = requestSpec();
    ModuleDiscoveryAgent agent = agent(request);

    agent.discoverAll(workspace, java.util.List.of("acme/billing", "acme/catalog"));

    assertThat(capturedUserMessage(request)).contains("billing/pom.xml");
  }

  private static ModuleDiscoveryAgent agent(ChatClient.ChatClientRequestSpec request) {
    ChatClient chatClient = mock(ChatClient.class);
    when(chatClient.prompt()).thenReturn(request);
    return new ModuleDiscoveryAgent(
        chatClient,
        new ModuleDiscoveryProperties(25, 50, 12_000, 500, 120),
        new DefaultResourceLoader());
  }

  private static ChatClient.ChatClientRequestSpec requestSpec() {
    ChatClient.ChatClientRequestSpec request = mock(ChatClient.ChatClientRequestSpec.class);
    ChatClient.CallResponseSpec call = mock(ChatClient.CallResponseSpec.class);
    when(request.system(anyString())).thenReturn(request);
    when(request.user(anyString())).thenReturn(request);
    when(request.tools(any(Object[].class))).thenReturn(request);
    when(request.call()).thenReturn(call);
    when(call.entity(AiModuleSuggestionPayload.class)).thenReturn(new AiModuleSuggestionPayload());
    return request;
  }

  private static String capturedUserMessage(ChatClient.ChatClientRequestSpec request) {
    ArgumentCaptor<String> userMessage = ArgumentCaptor.forClass(String.class);
    verify(request).user(userMessage.capture());
    return userMessage.getValue();
  }
}
