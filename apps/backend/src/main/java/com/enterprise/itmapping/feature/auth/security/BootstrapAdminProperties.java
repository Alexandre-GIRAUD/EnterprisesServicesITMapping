package com.enterprise.itmapping.feature.auth.security;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * When the {@code users} table is empty, create one admin if both username and password are
 * non-blank. Use only for first deployment; rotate credentials afterward. Env:
 * ADMIN_BOOTSTRAP_USERNAME, ADMIN_BOOTSTRAP_PASSWORD (relaxed binding for {@code
 * app.security.bootstrap-admin}).
 */
@ConfigurationProperties(prefix = "app.security.bootstrap-admin")
public record BootstrapAdminProperties(
    @DefaultValue("") String username, @DefaultValue("") String password) {}
