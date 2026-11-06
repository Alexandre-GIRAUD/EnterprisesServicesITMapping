package com.enterprise.itmapping.feature.signup.presentation;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.enterprise.itmapping.feature.history.application.PastSystemView;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/** Without an SMTP host, the emailed account flows do not exist. */
@WebMvcTest(
    controllers = {PasswordResetController.class, InvitationAcceptanceController.class},
    excludeAutoConfiguration = SecurityAutoConfiguration.class)
class AccountMailDisabledWebMvcTest {

  /** The as-of filter is part of every MVC slice; the tests never read a past view. */
  @MockBean PastSystemView pastSystemView;

  @Autowired MockMvc mockMvc;

  @Test
  void invitationAcceptanceAnswersNotFound() throws Exception {
    mockMvc
        .perform(
            post("/auth/accept-invitation")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"anything\",\"password\":\"example-pass-1\"}"))
        .andExpect(status().isNotFound());
  }

  @Test
  void forgotPasswordAnswersNotFound() throws Exception {
    mockMvc
        .perform(
            post("/auth/forgot-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"a@example.test\"}"))
        .andExpect(status().isNotFound());
  }
}
