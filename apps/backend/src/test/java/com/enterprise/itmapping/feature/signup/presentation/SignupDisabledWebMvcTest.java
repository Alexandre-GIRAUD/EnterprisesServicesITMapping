package com.enterprise.itmapping.feature.signup.presentation;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.enterprise.itmapping.feature.history.application.PastSystemView;
import com.enterprise.itmapping.feature.signup.application.SignupProperties;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/** On-premise default: the signup endpoints do not exist. */
@WebMvcTest(
    controllers = SignupController.class,
    excludeAutoConfiguration = SecurityAutoConfiguration.class)
@Import(SignupDisabledWebMvcTest.Properties.class)
class SignupDisabledWebMvcTest {

  /** The as-of filter is part of every MVC slice; the tests never read a past view. */
  @MockBean PastSystemView pastSystemView;

  @Autowired MockMvc mockMvc;

  @Test
  void signupAnswersNotFound() throws Exception {
    mockMvc
        .perform(
            post("/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\"a@example.test\",\"password\":\"password12\",\"workspaceName\":\"W\"}"))
        .andExpect(status().isNotFound());
  }

  @Test
  void aMalformedSignupStillAnswersNotFound() throws Exception {
    mockMvc
        .perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isNotFound());
  }

  @Test
  void verificationAnswersNotFound() throws Exception {
    mockMvc
        .perform(
            post("/auth/verify-email")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"anything\"}"))
        .andExpect(status().isNotFound());
  }

  @EnableConfigurationProperties(SignupProperties.class)
  static class Properties {}
}
