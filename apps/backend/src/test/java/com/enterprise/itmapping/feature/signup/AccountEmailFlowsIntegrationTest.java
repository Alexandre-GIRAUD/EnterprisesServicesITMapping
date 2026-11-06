package com.enterprise.itmapping.feature.signup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.signup.application.AccountEmail;
import com.enterprise.itmapping.feature.signup.application.AccountMailer;
import com.enterprise.itmapping.feature.signup.application.AccountTokens;
import com.enterprise.itmapping.feature.signup.domain.TokenPurpose;
import com.enterprise.itmapping.feature.workspace.domain.Workspaces;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.Neo4jContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/** Emailed account links other than signup: password reset, invitations, email change. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class AccountEmailFlowsIntegrationTest {

  private static final String PUBLIC_URL = "https://app.example.test";
  private static final String OLD_PASSWORD = "example-old-1";
  private static final String NEW_PASSWORD = "example-new-1";
  private static final int RESET_REQUESTS_PER_HOUR = 3;

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
    registry.add("app.signup.public-url", () -> PUBLIC_URL);
    registry.add("spring.mail.host", () -> "localhost");
  }

  @Autowired MockMvc mockMvc;
  @Autowired JdbcTemplate jdbcTemplate;
  @Autowired PasswordEncoder passwordEncoder;
  @Autowired UserRepository userRepository;
  @Autowired AccountTokens accountTokens;
  @MockBean AccountMailer accountMailer;

  @BeforeEach
  void forgetSentMail() {
    reset(accountMailer);
  }

  @Test
  void aForgottenPasswordIsReplacedFromTheEmailedLink() throws Exception {
    String email = createActiveUser();

    requestPasswordReset(email).andExpect(status().isAccepted());
    String token = tokenFrom(sentEmail(email), "/reset-password");
    resetPassword(token, NEW_PASSWORD)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.token").isNotEmpty())
        .andExpect(jsonPath("$.username").value(email));

    logIn(email, NEW_PASSWORD).andExpect(status().isOk());
    logIn(email, OLD_PASSWORD).andExpect(status().isUnauthorized());
    resetPassword(token, "example-again-1").andExpect(status().isBadRequest());
  }

  @Test
  void anUnknownEmailGetsTheSameAnswerAndNoEmail() throws Exception {
    requestPasswordReset(uniqueEmail()).andExpect(status().isAccepted());

    verify(accountMailer, never()).send(anyString(), any(AccountEmail.class));
  }

  @Test
  void resetRequestsAreLimitedPerEmail() throws Exception {
    String email = createActiveUser();

    for (int i = 0; i < RESET_REQUESTS_PER_HOUR + 1; i++) {
      requestPasswordReset(email).andExpect(status().isAccepted());
    }

    verify(accountMailer, times(RESET_REQUESTS_PER_HOUR)).send(eq(email), any(AccountEmail.class));
  }

  @Test
  void aLinkIssuedForAnotherPurposeCannotResetThePassword() throws Exception {
    String email = createActiveUser();
    String verificationToken =
        accountTokens.issue(
            userRepository.findByEmailIgnoreCase(email).orElseThrow(), TokenPurpose.VERIFY_EMAIL);

    resetPassword(verificationToken, NEW_PASSWORD).andExpect(status().isBadRequest());
  }

  @Test
  void aWeakNewPasswordIsRefused() throws Exception {
    String email = createActiveUser();
    requestPasswordReset(email).andExpect(status().isAccepted());

    resetPassword(tokenFrom(sentEmail(email), "/reset-password"), "short")
        .andExpect(status().isBadRequest());
  }

  private String createActiveUser() {
    String email = uniqueEmail();
    jdbcTemplate.update(
        "INSERT INTO users (id, username, email, password_hash, role, status, workspace_id)"
            + " VALUES (?, ?, ?, ?, 'USER', 'ACTIVE', ?)",
        UUID.randomUUID(),
        email,
        email,
        passwordEncoder.encode(OLD_PASSWORD),
        Workspaces.DEFAULT_ID);
    return email;
  }

  private ResultActions requestPasswordReset(String email) throws Exception {
    return mockMvc.perform(
        json(post("/auth/forgot-password"), "{\"email\":\"%s\"}".formatted(email)));
  }

  private ResultActions resetPassword(String token, String password) throws Exception {
    return mockMvc.perform(
        json(
            post("/auth/reset-password"),
            "{\"token\":\"%s\",\"password\":\"%s\"}".formatted(token, password)));
  }

  private ResultActions logIn(String email, String password) throws Exception {
    return mockMvc.perform(
        json(
            post("/auth/login"),
            "{\"username\":\"%s\",\"password\":\"%s\"}".formatted(email, password)));
  }

  private AccountEmail sentEmail(String to) {
    ArgumentCaptor<AccountEmail> sent = ArgumentCaptor.forClass(AccountEmail.class);
    verify(accountMailer).send(eq(to), sent.capture());
    return sent.getValue();
  }

  private static String tokenFrom(AccountEmail email, String path) {
    Matcher link =
        Pattern.compile(Pattern.quote(PUBLIC_URL + path + "?token=") + "([A-Za-z0-9_-]+)")
            .matcher(email.text());
    assertThat(link.find()).as("link to %s in %s", path, email.text()).isTrue();
    return link.group(1);
  }

  private static String uniqueEmail() {
    return "user-" + UUID.randomUUID() + "@example.test";
  }

  private static MockHttpServletRequestBuilder json(
      MockHttpServletRequestBuilder request, String body) {
    return request.contentType(MediaType.APPLICATION_JSON).content(body);
  }
}
