package com.enterprise.itmapping.feature.integrations.github.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.enterprise.itmapping.feature.integrations.github.GitHubApiClient;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

@ExtendWith(MockitoExtension.class)
class GitHubRepoFileContentServiceTest {

  private static final String BASE = "https://api.github.com";

  @Mock private GitHubApiClient apiClient;

  private MockRestServiceServer server;
  private RestClient client;
  private GitHubRepoFileContentService service;

  @BeforeEach
  void setUp() {
    RestClient.Builder builder = RestClient.builder().baseUrl(BASE);
    server = MockRestServiceServer.bindTo(builder).build();
    client = builder.build();
    service = new GitHubRepoFileContentService(apiClient);
  }

  private void stubAuthenticatedClient() {
    when(apiClient.hasToken()).thenReturn(true);
    when(apiClient.buildClient()).thenReturn(client);
  }

  private static String fileJson(String content) {
    String b64 = Base64.getEncoder().encodeToString(content.getBytes(StandardCharsets.UTF_8));
    return "{\"type\":\"file\",\"encoding\":\"base64\",\"content\":\"" + b64 + "\"}";
  }

  @Test
  void truncatesContentToMaxCharsPerFile() {
    stubAuthenticatedClient();
    server
        .expect(requestTo(BASE + "/repos/acme/widgets/contents/pom.xml"))
        .andRespond(withSuccess(fileJson("X".repeat(100)), MediaType.APPLICATION_JSON));

    Map<String, String> result =
        service.fetchFileContents("acme", "widgets", List.of("pom.xml"), 10);

    server.verify();
    assertThat(result).containsKey("pom.xml");
    assertThat(result.get("pom.xml")).startsWith("XXXXXXXXXX");
    assertThat(result.get("pom.xml")).contains("truncated");
    assertThat(result.get("pom.xml")).doesNotContain("X".repeat(11));
  }

  @Test
  void skipsMissingFilesOn404() {
    stubAuthenticatedClient();
    server
        .expect(requestTo(BASE + "/repos/acme/widgets/contents/pom.xml"))
        .andRespond(withSuccess(fileJson("hello"), MediaType.APPLICATION_JSON));
    server
        .expect(requestTo(BASE + "/repos/acme/widgets/contents/missing.txt"))
        .andRespond(withStatus(HttpStatus.NOT_FOUND));

    Map<String, String> result =
        service.fetchFileContents("acme", "widgets", List.of("pom.xml", "missing.txt"), 5000);

    server.verify();
    assertThat(result).containsOnlyKeys("pom.xml");
    assertThat(result.get("pom.xml")).isEqualTo("hello");
  }

  @Test
  void returnsEmptyWhenNoToken() {
    when(apiClient.hasToken()).thenReturn(false);
    Map<String, String> result =
        service.fetchFileContents("acme", "widgets", List.of("pom.xml"), 5000);
    assertThat(result).isEmpty();
  }
}
