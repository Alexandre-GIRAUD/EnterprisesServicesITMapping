package com.enterprise.itmapping.config;

import com.enterprise.itmapping.feature.workspace.application.CurrentWorkspace;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskDecorator;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableAsync
@EnableScheduling
public class AsyncConfig {

  /** Sign-off timestamps read this clock so a test can fix the instant. */
  @Bean
  Clock clock() {
    return Clock.systemUTC();
  }

  /** {@code @Async} work runs in the workspace of the thread that started it. */
  @Bean
  TaskDecorator workspaceTaskDecorator() {
    return CurrentWorkspace::decorate;
  }
}
