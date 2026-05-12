package com.enterprise.itmapping.feature.auth.security;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "app.cors")
public record CorsProperties(
    /** Comma-separated browser origins allowed for CORS (SPA dev servers). */
    @DefaultValue("http://localhost:5173,http://localhost:3000") String allowedOrigins) {}
