package com.enterprise.itmapping.feature.integrations;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.endsWith;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.enterprise.itmapping.feature.integrations.bitbucket.BitbucketApiClient;
import com.enterprise.itmapping.feature.integrations.bitbucket.application.BitbucketIdentity;
import com.enterprise.itmapping.feature.integrations.bitbucket.application.BitbucketTokenClient;
import com.enterprise.itmapping.feature.integrations.github.GitHubApiClient;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubIdentity;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubTokenClient;
import com.enterprise.itmapping.feature.workspace.application.CurrentWorkspace;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.testcontainers.containers.Neo4jContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/** GitHub and Bitbucket access belongs to the workspace and is set by its admins. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class WorkspaceGitConnectionsIntegrationTest {

  private static final String GITHUB_TOKEN_OF_A = "example-github-token-a";
  private static final String BITBUCKET_TOKEN_OF_A = "example-bitbucket-token-a";
  private static final byte[] PUSH =
      "{\"ref\":\"refs/heads/main\",\"repository\":{\"full_name\":\"acme/demo\"},\"after\":\"abc123def456\"}"
          .getBytes(StandardCharsets.UTF_8);

  @Container
  static PostgreSQLContainer<?> postgres =
      new PostgreSQLContainer<>(
              DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"))
          .withDatabaseName("itmapping")
          .withUsername("itmapping")
          .withPassword("itmapping");

  @Container
  static Neo4jContainer<?> neo4j =
      new Neo4jContainer<>(DockerImageName.parse("neo4j:5-community")).withAdminPassword("password");

  @DynamicPropertySource
  static void containerProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
    registry.add("spring.datasource.username", postgres::getUsername);
    registry.add("spring.datasource.password", postgres::getPassword);
    registry.add("spring.neo4j.uri", neo4j::getBoltUrl);
    registry.add("spring.neo4j.authentication.username", () -> "neo4j");
    registry.add("spring.neo4j.authentication.password", neo4j::getAdminPassword);
    registry.add("app.integrations.github.token", () -> "example-ignored-server-token");
  }

  @Autowired MockMvc mockMvc;
  @Autowired JdbcTemplate jdbcTemplate;
  @Autowired GitHubApiClient gitHubApiClient;
  @Autowired BitbucketApiClient bitbucketApiClient;
  @MockBean GitHubTokenClient gitHubTokenClient;
  @MockBean BitbucketTokenClient bitbucketTokenClient;

  private Workspace workspaceA;
  private Workspace workspaceB;

  @BeforeEach
  void createTwoWorkspaces() {
    when(gitHubTokenClient.identify(anyString()))
        .thenAnswer(call -> new GitHubIdentity("octo-a", call.getArgument(0)));
    when(bitbucketTokenClient.identify(anyString()))
        .thenAnswer(call -> new BitbucketIdentity("bucket-a", call.getArgument(0)));
    workspaceA = createWorkspace("A");
    workspaceB = createWorkspace("B");
  }

  @Test
  void anAdminConnectsGitHubForTheWholeWorkspaceOnly() throws Exception {
    saveToken("github", workspaceA.admin(), GITHUB_TOKEN_OF_A)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.connected").value(true))
        .andExpect(jsonPath("$.login").value("octo-a"));

    readConnection("github", workspaceA.member())
        .andExpect(jsonPath("$.connected").value(true))
        .andExpect(jsonPath("$.login").value("octo-a"));
    readConnection("github", workspaceB.member()).andExpect(jsonPath("$.connected").value(false));
    assertThat(gitHubTokenIn(workspaceA)).isEqualTo(GITHUB_TOKEN_OF_A);
    assertThat(gitHubTokenIn(workspaceB)).isEmpty();
    assertThat(
            jdbcTemplate.queryForObject(
                "SELECT github_token FROM workspaces WHERE id = ?", String.class, workspaceA.id()))
        .isNotBlank()
        .doesNotContain(GITHUB_TOKEN_OF_A);
  }

  @Test
  void anAdminConnectsBitbucketForTheWholeWorkspaceOnly() throws Exception {
    saveToken("bitbucket", workspaceA.admin(), BITBUCKET_TOKEN_OF_A)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.username").value("bucket-a"));

    readConnection("bitbucket", workspaceA.member())
        .andExpect(jsonPath("$.connected").value(true));
    readConnection("bitbucket", workspaceB.member())
        .andExpect(jsonPath("$.connected").value(false));
    AtomicReference<String> tokenOfA = new AtomicReference<>();
    CurrentWorkspace.runAs(workspaceA.id(), () -> tokenOfA.set(bitbucketApiClient.token()));
    assertThat(tokenOfA.get()).isEqualTo(BITBUCKET_TOKEN_OF_A);
  }

  @Test
  void membersCannotChangeTheConnection() throws Exception {
    saveToken("github", workspaceA.member(), GITHUB_TOKEN_OF_A).andExpect(status().isForbidden());
    mockMvc
        .perform(delete("/integrations/bitbucket/connection").with(workspaceA.member()))
        .andExpect(status().isForbidden());
  }

  @Test
  void anAdminDisconnectsTheWorkspace() throws Exception {
    saveToken("github", workspaceA.admin(), GITHUB_TOKEN_OF_A).andExpect(status().isOk());

    mockMvc
        .perform(delete("/integrations/github/connection").with(workspaceA.admin()))
        .andExpect(status().isOk());

    readConnection("github", workspaceA.member()).andExpect(jsonPath("$.connected").value(false));
    assertThat(gitHubTokenIn(workspaceA)).isEmpty();
  }

  @Test
  void eachWorkspaceReceivesPushesOnItsOwnSignedUrl() throws Exception {
    String secretOfA = readWebhookSecret(workspaceA);
    String secretOfB = readWebhookSecret(workspaceB);
    assertThat(secretOfA).isNotBlank().isNotEqualTo(secretOfB).isEqualTo(readWebhookSecret(workspaceA));

    pushTo(workspaceA.id(), secretOfA).andExpect(status().isAccepted());
    pushTo(workspaceB.id(), secretOfA).andExpect(status().isUnauthorized());
  }

  @Test
  void regeneratingTheSecretRetiresTheOldOne() throws Exception {
    String oldSecret = readWebhookSecret(workspaceA);

    String newSecret =
        mockMvc
            .perform(post("/integrations/github/webhook/secret").with(workspaceA.admin()))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString()
            .replaceAll(".*\"secret\":\"([^\"]+)\".*", "$1");

    assertThat(newSecret).isNotEqualTo(oldSecret);
    pushTo(workspaceA.id(), oldSecret).andExpect(status().isUnauthorized());
    pushTo(workspaceA.id(), newSecret).andExpect(status().isAccepted());
  }

  @Test
  void onlyAdminsSeeTheWebhookSecret() throws Exception {
    mockMvc
        .perform(get("/integrations/github/webhook").with(workspaceA.member()))
        .andExpect(status().isForbidden());
  }

  @Test
  void theLegacyWebhookUrlIsGoneWithoutTheGlobalSecret() throws Exception {
    mockMvc
        .perform(
            post("/webhooks/github")
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-GitHub-Event", "push")
                .content(PUSH))
        .andExpect(status().isNotFound());
  }

  private String readWebhookSecret(Workspace workspace) throws Exception {
    return mockMvc
        .perform(get("/integrations/github/webhook").with(workspace.admin()))
        .andExpect(status().isOk())
        // The test configuration has no /api context path; production prefixes it.
        .andExpect(jsonPath("$.path").value(endsWith("/webhooks/github/" + workspace.id())))
        .andReturn()
        .getResponse()
        .getContentAsString()
        .replaceAll(".*\"secret\":\"([^\"]+)\".*", "$1");
  }

  private ResultActions pushTo(UUID workspaceId, String secret) throws Exception {
    return mockMvc.perform(
        post("/webhooks/github/" + workspaceId)
            .contentType(MediaType.APPLICATION_JSON)
            .header("X-GitHub-Event", "push")
            .header("X-Hub-Signature-256", "sha256=" + hmacSha256(secret, PUSH))
            .content(PUSH));
  }

  private static String hmacSha256(String secret, byte[] body) throws Exception {
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    return HexFormat.of().formatHex(mac.doFinal(body));
  }

  @Test
  void theServerTokenIsNeverUsed() {
    assertThat(gitHubTokenIn(workspaceB)).isEmpty();
  }

  private ResultActions saveToken(String provider, RequestPostProcessor who, String token)
      throws Exception {
    return mockMvc.perform(
        put("/integrations/" + provider + "/connection")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"token\":\"" + token + "\"}")
            .with(who));
  }

  private ResultActions readConnection(String provider, RequestPostProcessor who)
      throws Exception {
    return mockMvc
        .perform(get("/integrations/" + provider + "/connection").with(who))
        .andExpect(status().isOk());
  }

  private String gitHubTokenIn(Workspace workspace) {
    AtomicReference<String> token = new AtomicReference<>();
    CurrentWorkspace.runAs(workspace.id(), () -> token.set(gitHubApiClient.token()));
    return token.get();
  }

  private Workspace createWorkspace(String name) {
    UUID id = UUID.randomUUID();
    jdbcTemplate.update("INSERT INTO workspaces (id, name) VALUES (?, ?)", id, name);
    return new Workspace(id, createUser(id, "ADMIN"), createUser(id, "USER"));
  }

  private RequestPostProcessor createUser(UUID workspaceId, String role) {
    UUID id = UUID.randomUUID();
    jdbcTemplate.update(
        "INSERT INTO users (id, username, password_hash, role, status, workspace_id)"
            + " VALUES (?, ?, 'x', ?, 'ACTIVE', ?)",
        id,
        "user-" + id,
        role,
        workspaceId);
    return user(id.toString()).roles(role);
  }

  private record Workspace(UUID id, RequestPostProcessor admin, RequestPostProcessor member) {}
}
