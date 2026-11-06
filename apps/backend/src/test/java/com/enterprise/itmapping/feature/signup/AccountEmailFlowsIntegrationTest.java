package com.enterprise.itmapping.feature.signup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.signup.application.AccountEmail;
import com.enterprise.itmapping.feature.signup.application.AccountMailer;
import com.enterprise.itmapping.feature.signup.application.AccountTokens;
import com.enterprise.itmapping.feature.signup.application.InvitationPurge;
import com.enterprise.itmapping.feature.signup.domain.TokenPurpose;
import com.enterprise.itmapping.feature.workspace.domain.Workspaces;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
import org.springframework.test.web.servlet.request.RequestPostProcessor;
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
  private static final int INVITATIONS_PER_WORKSPACE_PER_HOUR = 20;

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
  @Autowired InvitationPurge invitationPurge;
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

  @Test
  void anInviteeChoosesAPasswordAndJoinsTheWorkspaceWithTheChosenRole() throws Exception {
    Admin admin = createWorkspaceAdmin("Acme");
    String invitee = uniqueEmail();

    invite(admin, invitee, "USER").andExpect(status().isCreated());
    mockMvc
        .perform(get("/admin/invitations").with(asAdmin(admin)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].email").value(invitee))
        .andExpect(jsonPath("$[0].role").value("USER"))
        .andExpect(jsonPath("$[0].status").value("INVITED"));
    AccountEmail email = sentEmail(invitee);
    assertThat(email.subject()).isEqualTo("You are invited to Acme on Flowra");
    String token = tokenFrom(email, "/accept-invitation");

    acceptInvitation(token, NEW_PASSWORD)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.username").value(invitee))
        .andExpect(jsonPath("$.roles[0]").value("USER"))
        .andExpect(jsonPath("$.workspaceName").value("Acme"));

    assertThat(
            jdbcTemplate.queryForObject(
                "SELECT workspace_id FROM users WHERE email = ?", UUID.class, invitee))
        .isEqualTo(admin.workspaceId());
    acceptInvitation(token, NEW_PASSWORD).andExpect(status().isBadRequest());
    mockMvc
        .perform(get("/admin/invitations").with(asAdmin(admin)))
        .andExpect(jsonPath("$.length()").value(0));
  }

  @Test
  void anEmailThatAlreadyHasAnAccountCannotBeInvited() throws Exception {
    Admin admin = createWorkspaceAdmin("Taken");

    invite(admin, createActiveUser(), "USER")
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.message").value("This email already has a Flowra account."));
  }

  @Test
  void anAdminCannotTouchTheInvitationsOfAnotherWorkspace() throws Exception {
    Admin owner = createWorkspaceAdmin("Owner");
    Admin stranger = createWorkspaceAdmin("Stranger");
    invite(owner, uniqueEmail(), "USER").andExpect(status().isCreated());
    UUID invitationId =
        jdbcTemplate.queryForObject(
            "SELECT id FROM invitations WHERE workspace_id = ?", UUID.class, owner.workspaceId());

    mockMvc
        .perform(delete("/admin/invitations/" + invitationId).with(asAdmin(stranger)))
        .andExpect(status().isNotFound());
    mockMvc
        .perform(get("/admin/invitations").with(asAdmin(stranger)))
        .andExpect(jsonPath("$.length()").value(0));
  }

  @Test
  void anExpiredInvitationIsListedAsExpiredAndCannotBeAccepted() throws Exception {
    Admin admin = createWorkspaceAdmin("Late");
    String invitee = uniqueEmail();
    invite(admin, invitee, "ADMIN").andExpect(status().isCreated());
    String token = tokenFrom(sentEmail(invitee), "/accept-invitation");
    jdbcTemplate.update(
        "UPDATE invitations SET expires_at = ? WHERE email = ?",
        Timestamp.from(Instant.now().minus(1, ChronoUnit.MINUTES)),
        invitee);

    mockMvc
        .perform(get("/admin/invitations").with(asAdmin(admin)))
        .andExpect(jsonPath("$[0].status").value("EXPIRED"));
    acceptInvitation(token, NEW_PASSWORD).andExpect(status().isBadRequest());
  }

  @Test
  void resendingMailsAFreshLinkAndRetiresTheOldOne() throws Exception {
    Admin admin = createWorkspaceAdmin("Again");
    String invitee = uniqueEmail();
    invite(admin, invitee, "USER").andExpect(status().isCreated());
    String firstToken = tokenFrom(sentEmail(invitee), "/accept-invitation");
    UUID invitationId =
        jdbcTemplate.queryForObject("SELECT id FROM invitations WHERE email = ?", UUID.class, invitee);
    reset(accountMailer);

    mockMvc
        .perform(post("/admin/invitations/" + invitationId + "/resend").with(asAdmin(admin)))
        .andExpect(status().isNoContent());

    String secondToken = tokenFrom(sentEmail(invitee), "/accept-invitation");
    acceptInvitation(firstToken, NEW_PASSWORD).andExpect(status().isBadRequest());
    acceptInvitation(secondToken, NEW_PASSWORD).andExpect(status().isOk());
  }

  @Test
  void invitationsArePacedPerWorkspace() throws Exception {
    Admin admin = createWorkspaceAdmin("Busy");
    for (int i = 0; i < INVITATIONS_PER_WORKSPACE_PER_HOUR; i++) {
      invite(admin, uniqueEmail(), "USER").andExpect(status().isCreated());
    }

    invite(admin, uniqueEmail(), "USER").andExpect(status().isTooManyRequests());
  }

  @Test
  void invitationsExpiredForAMonthAreRemovedEachNight() throws Exception {
    Admin admin = createWorkspaceAdmin("Old");
    String stale = uniqueEmail();
    String recent = uniqueEmail();
    invite(admin, stale, "USER").andExpect(status().isCreated());
    invite(admin, recent, "USER").andExpect(status().isCreated());
    jdbcTemplate.update(
        "UPDATE invitations SET expires_at = ? WHERE email = ?",
        Timestamp.from(Instant.now().minus(31, ChronoUnit.DAYS)),
        stale);

    invitationPurge.purgeExpired();

    assertThat(
            jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM invitations WHERE email IN (?, ?)", Integer.class, stale, recent))
        .isEqualTo(1);
  }

  @Test
  void onlyAdminsInvite() throws Exception {
    Admin admin = createWorkspaceAdmin("Members");
    String member = createActiveUser();
    jdbcTemplate.update("UPDATE users SET workspace_id = ? WHERE email = ?", admin.workspaceId(), member);

    mockMvc
        .perform(
            json(post("/admin/invitations"), "{\"email\":\"%s\",\"role\":\"USER\"}".formatted(uniqueEmail()))
                .with(user(member).roles("USER")))
        .andExpect(status().isForbidden());
  }

  private Admin createWorkspaceAdmin(String workspaceName) {
    UUID workspaceId = UUID.randomUUID();
    jdbcTemplate.update("INSERT INTO workspaces (id, name) VALUES (?, ?)", workspaceId, workspaceName);
    String email = uniqueEmail();
    jdbcTemplate.update(
        "INSERT INTO users (id, username, email, password_hash, role, status, workspace_id)"
            + " VALUES (?, ?, ?, 'x', 'ADMIN', 'ACTIVE', ?)",
        UUID.randomUUID(),
        email,
        email,
        workspaceId);
    return new Admin(email, workspaceId);
  }

  private static RequestPostProcessor asAdmin(Admin admin) {
    return user(admin.username()).roles("ADMIN");
  }

  private ResultActions invite(Admin admin, String email, String role) throws Exception {
    return mockMvc.perform(
        json(
                post("/admin/invitations"),
                "{\"email\":\"%s\",\"role\":\"%s\"}".formatted(email, role))
            .with(asAdmin(admin)));
  }

  private ResultActions acceptInvitation(String token, String password) throws Exception {
    return mockMvc.perform(
        json(
            post("/auth/accept-invitation"),
            "{\"token\":\"%s\",\"password\":\"%s\"}".formatted(token, password)));
  }

  private record Admin(String username, UUID workspaceId) {}

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
