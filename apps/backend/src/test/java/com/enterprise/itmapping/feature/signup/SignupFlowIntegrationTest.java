package com.enterprise.itmapping.feature.signup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.enterprise.itmapping.feature.signup.application.PendingAccountPurge;
import com.enterprise.itmapping.feature.signup.application.VerificationMailer;
import com.enterprise.itmapping.feature.signup.application.VerificationTokens;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.Neo4jContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/** Sign up, confirm the email, sign in: a new admin of a new, empty workspace. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class SignupFlowIntegrationTest {

  private static final String PUBLIC_URL = "https://app.example.test";
  private static final String PASSWORD = "correct-horse-1";
  private static final int SIGNUPS_PER_HOUR = 5;
  private static final int RESENDS_PER_HOUR = 3;
  private static final AtomicInteger NEXT_ADDRESS = new AtomicInteger(1);

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
    registry.add("app.signup.enabled", () -> "true");
    registry.add("app.signup.public-url", () -> PUBLIC_URL);
    registry.add("spring.mail.host", () -> "localhost");
    registry.add("app.integrations.github.token", () -> "");
  }

  @Autowired MockMvc mockMvc;
  @Autowired JdbcTemplate jdbcTemplate;
  @Autowired PendingAccountPurge pendingAccountPurge;
  @MockBean VerificationMailer verificationMailer;

  @BeforeEach
  void forgetSentMail() {
    reset(verificationMailer);
  }

  @Test
  void signUpConfirmAndSignInAsAdminOfANewWorkspace() throws Exception {
    String email = uniqueEmail();

    signUp(email, "Acme Bank", nextAddress())
        .andExpect(status().isAccepted())
        .andExpect(jsonPath("$.email").value(email));
    logIn(email).andExpect(status().isForbidden());

    String token = tokenFromLink(sentLink(email));
    mockMvc
        .perform(json(post("/auth/verify-email"), "{\"token\":\"" + token + "\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.token").isNotEmpty())
        .andExpect(jsonPath("$.username").value(email))
        .andExpect(jsonPath("$.roles[0]").value("ADMIN"))
        .andExpect(jsonPath("$.workspaceName").value("Acme Bank"));

    logIn(email).andExpect(status().isOk()).andExpect(jsonPath("$.workspaceName").value("Acme Bank"));
    assertThat(
            jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users u JOIN workspaces w ON w.id = u.workspace_id"
                    + " WHERE u.email = ? AND w.name = 'Acme Bank'",
                Integer.class,
                email))
        .isEqualTo(1);
  }

  @Test
  void aVerificationLinkWorksOnlyOnce() throws Exception {
    String email = uniqueEmail();
    signUp(email, "Once", nextAddress()).andExpect(status().isAccepted());
    String body = "{\"token\":\"" + tokenFromLink(sentLink(email)) + "\"}";

    mockMvc.perform(json(post("/auth/verify-email"), body)).andExpect(status().isOk());
    mockMvc.perform(json(post("/auth/verify-email"), body)).andExpect(status().isBadRequest());
  }

  @Test
  void anExpiredVerificationLinkIsRefused() throws Exception {
    String email = uniqueEmail();
    signUp(email, "Late", nextAddress()).andExpect(status().isAccepted());
    String token = tokenFromLink(sentLink(email));
    jdbcTemplate.update(
        "UPDATE email_verification_tokens SET expires_at = ? WHERE token_hash = ?",
        Timestamp.from(Instant.now().minus(1, ChronoUnit.MINUTES)),
        VerificationTokens.hash(token));

    mockMvc
        .perform(json(post("/auth/verify-email"), "{\"token\":\"" + token + "\"}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void anEmailCanOwnOnlyOneAccount() throws Exception {
    String email = uniqueEmail();
    signUp(email, "First", nextAddress()).andExpect(status().isAccepted());

    signUp(email, "Second", nextAddress()).andExpect(status().isConflict());
  }

  @Test
  void signupsFromOneAddressAreLimitedPerHour() throws Exception {
    String address = nextAddress();
    for (int i = 0; i < SIGNUPS_PER_HOUR; i++) {
      signUp(uniqueEmail(), "Burst", address).andExpect(status().isAccepted());
    }

    signUp(uniqueEmail(), "Burst", address).andExpect(status().isTooManyRequests());
  }

  @Test
  void resendingTheLinkIsLimitedAndNeverRevealsWhetherTheEmailExists() throws Exception {
    String email = uniqueEmail();
    signUp(email, "Resend", nextAddress()).andExpect(status().isAccepted());
    String resendBody = "{\"email\":\"" + email + "\"}";

    for (int i = 0; i < RESENDS_PER_HOUR + 1; i++) {
      mockMvc
          .perform(json(post("/auth/resend-verification"), resendBody))
          .andExpect(status().isAccepted());
    }
    mockMvc
        .perform(json(post("/auth/resend-verification"), "{\"email\":\"" + uniqueEmail() + "\"}"))
        .andExpect(status().isAccepted());

    verify(verificationMailer, times(1 + RESENDS_PER_HOUR))
        .sendVerificationLink(eq(email), anyString());
  }

  @Test
  void unconfirmedAccountsAreRemovedAfterAWeekWithTheirWorkspace() throws Exception {
    String stale = uniqueEmail();
    String fresh = uniqueEmail();
    signUp(stale, "Stale", nextAddress()).andExpect(status().isAccepted());
    signUp(fresh, "Fresh", nextAddress()).andExpect(status().isAccepted());
    UUID staleWorkspace =
        jdbcTemplate.queryForObject(
            "SELECT workspace_id FROM users WHERE email = ?", UUID.class, stale);
    jdbcTemplate.update(
        "UPDATE users SET created_at = ? WHERE email = ?",
        Timestamp.from(Instant.now().minus(8, ChronoUnit.DAYS)),
        stale);

    pendingAccountPurge.purgeExpired();

    assertThat(countUsers(stale)).isZero();
    assertThat(countUsers(fresh)).isEqualTo(1);
    assertThat(
            jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM workspaces WHERE id = ?", Integer.class, staleWorkspace))
        .isZero();
    signUp(stale, "Again", nextAddress()).andExpect(status().isAccepted());
  }

  @Test
  void aWeakPasswordIsRefused() throws Exception {
    mockMvc
        .perform(
            json(
                post("/auth/signup"),
                "{\"email\":\"" + uniqueEmail() + "\",\"password\":\"short\",\"workspaceName\":\"W\"}"))
        .andExpect(status().isBadRequest());
    verify(verificationMailer, never()).sendVerificationLink(anyString(), anyString());
  }

  private ResultActions signUp(String email, String workspaceName, String address) throws Exception {
    String body =
        "{\"email\":\"%s\",\"password\":\"%s\",\"workspaceName\":\"%s\"}"
            .formatted(email, PASSWORD, workspaceName);
    return mockMvc.perform(
        json(post("/auth/signup"), body)
            .with(
                request -> {
                  request.setRemoteAddr(address);
                  return request;
                }));
  }

  private ResultActions logIn(String email) throws Exception {
    return mockMvc.perform(
        json(
            post("/auth/login"),
            "{\"username\":\"%s\",\"password\":\"%s\"}".formatted(email, PASSWORD)));
  }

  private String sentLink(String email) {
    ArgumentCaptor<String> link = ArgumentCaptor.forClass(String.class);
    verify(verificationMailer).sendVerificationLink(eq(email), link.capture());
    assertThat(link.getValue()).startsWith(PUBLIC_URL + "/verify-email?token=");
    return link.getValue();
  }

  private static String tokenFromLink(String link) {
    return link.substring(link.indexOf("token=") + "token=".length());
  }

  private int countUsers(String email) {
    Integer n =
        jdbcTemplate.queryForObject("SELECT COUNT(*) FROM users WHERE email = ?", Integer.class, email);
    return n != null ? n : 0;
  }

  private static String uniqueEmail() {
    return "user-" + UUID.randomUUID() + "@example.test";
  }

  private static String nextAddress() {
    return "10.0.0." + NEXT_ADDRESS.getAndIncrement();
  }

  private static MockHttpServletRequestBuilder json(
      MockHttpServletRequestBuilder request, String body) {
    return request.contentType(MediaType.APPLICATION_JSON).content(body);
  }
}
