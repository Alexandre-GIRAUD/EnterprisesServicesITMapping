package com.enterprise.itmapping.feature.auth.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.enterprise.itmapping.feature.auth.application.UserAdminService;
import com.enterprise.itmapping.feature.auth.presentation.dto.CreateUserRequest;
import com.enterprise.itmapping.feature.auth.presentation.dto.UserSummaryResponse;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = AdminUserController.class, excludeAutoConfiguration = SecurityAutoConfiguration.class)
class AdminUserControllerWebMvcTest {

  @Autowired MockMvc mockMvc;

  @MockBean UserAdminService userAdminService;

  @Test
  void createUserReturns201() throws Exception {
    UUID id = UUID.randomUUID();
    when(userAdminService.createUser(any(CreateUserRequest.class)))
        .thenReturn(new UserSummaryResponse(id, "bob", "USER", Instant.parse("2026-01-01T00:00:00Z")));

    mockMvc
        .perform(
            post("/admin/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"bob\",\"password\":\"password12\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.username").value("bob"));
  }

  @Test
  void listUsersReturnsArray() throws Exception {
    when(userAdminService.listUsers())
        .thenReturn(
            List.of(
                new UserSummaryResponse(
                    UUID.randomUUID(), "alice", "ADMIN", Instant.parse("2026-01-02T00:00:00Z"))));

    mockMvc
        .perform(get("/admin/users").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].username").value("alice"));
  }
}
