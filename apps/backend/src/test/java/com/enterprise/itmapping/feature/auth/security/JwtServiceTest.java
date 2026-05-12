package com.enterprise.itmapping.feature.auth.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class JwtServiceTest {

  @Test
  void tokenRoundTrip() {
    JwtProperties p = new JwtProperties("0".repeat(32), 3_600_000L);
    JwtService s = new JwtService(p);
    ReflectionTestUtils.invokeMethod(s, "initKey");
    String jwt = s.createToken("alice", "USER");
    assertThat(s.parseOptional(jwt)).isPresent();
    assertThat(s.parseOptional(jwt).orElseThrow().getSubject()).isEqualTo("alice");
    assertThat(JwtService.rolesFromClaims(s.parseOptional(jwt).orElseThrow()))
        .containsExactly("USER");
  }
}
