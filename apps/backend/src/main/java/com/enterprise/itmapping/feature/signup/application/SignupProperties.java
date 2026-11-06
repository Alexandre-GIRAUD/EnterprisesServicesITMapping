package com.enterprise.itmapping.feature.signup.application;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Self-service signup. Off by default so on-premise installs keep admin-created accounts only.
 *
 * @param enabled {@code APP_SIGNUP_ENABLED}
 * @param publicUrl {@code APP_PUBLIC_URL}, the browser origin verification links point to
 */
@ConfigurationProperties(prefix = "app.signup")
public record SignupProperties(
    @DefaultValue("false") boolean enabled, @DefaultValue("") String publicUrl) {}
