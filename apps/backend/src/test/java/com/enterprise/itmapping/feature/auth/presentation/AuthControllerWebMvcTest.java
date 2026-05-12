package com.enterprise.itmapping.feature.auth.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.enterprise.itmapping.feature.auth.application.AuthService;
import com.enterprise.itmapping.feature.auth.presentation.dto.LoginRequest;
import com.enterprise.itmapping.feature.auth.presentation.dto.LoginResponse;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = AuthController.class, excludeAutoConfiguration = SecurityAutoConfiguration.class)
class AuthControllerWebMvcTest {

  @Autowired MockMvc mockMvc;

  @MockBean AuthService authService;

  @Test
  void loginReturnsJson() throws Exception {
    when(authService.login(any(LoginRequest.class)))
        .thenReturn(new LoginResponse("jwt-test", "admin", List.of("ADMIN")));

    mockMvc
        .perform(
            post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"admin\",\"password\":\"secret\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.token").value("jwt-test"))
        .andExpect(jsonPath("$.username").value("admin"));
  }
}
