package com.enterprise.itmapping.feature.signup.presentation;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
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
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    controllers = PublicConfigController.class,
    excludeAutoConfiguration = SecurityAutoConfiguration.class)
@Import(PublicConfigControllerWebMvcTest.Properties.class)
@TestPropertySource(
    properties = {"app.signup.enabled=true", "spring.mail.host=smtp.example.test"})
class PublicConfigControllerWebMvcTest {

  /** The as-of filter is part of every MVC slice; the tests never read a past view. */
  @MockBean PastSystemView pastSystemView;

  @Autowired MockMvc mockMvc;

  @Test
  void tellsTheUiWhetherSignupIsOpenAndMailCanBeSent() throws Exception {
    mockMvc
        .perform(get("/config"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.signupEnabled").value(true))
        .andExpect(jsonPath("$.mailEnabled").value(true));
  }

  @EnableConfigurationProperties(SignupProperties.class)
  static class Properties {}
}
