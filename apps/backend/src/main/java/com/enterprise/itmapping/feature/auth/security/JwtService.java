package com.enterprise.itmapping.feature.auth.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class JwtService {

  private final JwtProperties properties;
  private SecretKey secretKey;

  public JwtService(JwtProperties properties) {
    this.properties = properties;
  }

  @PostConstruct
  void initKey() {
    String raw = properties.secret() != null ? properties.secret().trim() : "";
    if (!StringUtils.hasText(raw)) {
      throw new IllegalStateException(
          "JWT_SECRET (app.security.jwt.secret) must be set to a non-empty value (>= 32 UTF-8 bytes for HS256).");
    }
    byte[] bytes = raw.getBytes(StandardCharsets.UTF_8);
    if (bytes.length < 32) {
      throw new IllegalStateException(
          "JWT_SECRET must be at least 32 bytes in UTF-8 for HS256 signing.");
    }
    this.secretKey = Keys.hmacShaKeyFor(bytes);
  }

  public String createToken(String username, String roleName) {
    Instant now = Instant.now();
    Instant exp = now.plusMillis(Math.max(60_000L, properties.expirationMs()));
    return Jwts.builder()
        .subject(username)
        .claim("roles", roleName)
        .issuedAt(Date.from(now))
        .expiration(Date.from(exp))
        .signWith(secretKey)
        .compact();
  }

  public Optional<Claims> parseOptional(String token) {
    if (!StringUtils.hasText(token)) {
      return Optional.empty();
    }
    try {
      return Optional.of(
          Jwts.parser().verifyWith(secretKey).build().parseSignedClaims(token.trim()).getPayload());
    } catch (JwtException | IllegalArgumentException e) {
      return Optional.empty();
    }
  }

  public static List<String> rolesFromClaims(Claims claims) {
    Object raw = claims.get("roles");
    if (raw == null) {
      return List.of();
    }
    if (raw instanceof String s) {
      return List.of(s);
    }
    if (raw instanceof List<?> list) {
      return list.stream().map(Object::toString).toList();
    }
    return List.of(raw.toString());
  }
}
