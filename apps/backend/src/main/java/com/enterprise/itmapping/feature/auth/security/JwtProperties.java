package com.enterprise.itmapping.feature.auth.security;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "app.security.jwt")
public record JwtProperties(
    /** HS256 signing secret (UTF-8); must be at least 32 bytes. Set via JWT_SECRET. */
    @DefaultValue("") String secret,
    @DefaultValue("86400000") long expirationMs) {}
