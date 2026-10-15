package com.enterprise.itmapping.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

@Configuration
@EnableAsync
public class AsyncConfig {

  /** Sign-off timestamps read this clock so a test can fix the instant. */
  @Bean
  Clock clock() {
    return Clock.systemUTC();
  }
}
