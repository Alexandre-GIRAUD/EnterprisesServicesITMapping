package com.enterprise.itmapping;

import com.enterprise.itmapping.feature.auth.security.BootstrapAdminProperties;
import com.enterprise.itmapping.feature.auth.security.CorsProperties;
import com.enterprise.itmapping.feature.auth.security.JwtProperties;
import com.enterprise.itmapping.feature.integrations.github.GitHubIntegrationProperties;
import com.enterprise.itmapping.feature.integrations.llm.ConnectionDiscoveryProperties;
import com.enterprise.itmapping.feature.integrations.llm.ModuleDiscoveryProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties({
  GitHubIntegrationProperties.class,
  ModuleDiscoveryProperties.class,
  ConnectionDiscoveryProperties.class,
  JwtProperties.class,
  BootstrapAdminProperties.class,
  CorsProperties.class
})
public class BackendApplication {

  public static void main(String[] args) {
    SpringApplication.run(BackendApplication.class, args);
  }
}
