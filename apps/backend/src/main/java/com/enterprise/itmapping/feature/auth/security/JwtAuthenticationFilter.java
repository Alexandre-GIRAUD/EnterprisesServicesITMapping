package com.enterprise.itmapping.feature.auth.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

public class JwtAuthenticationFilter extends OncePerRequestFilter {

  private final JwtService jwtService;

  public JwtAuthenticationFilter(JwtService jwtService) {
    this.jwtService = jwtService;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    String header = request.getHeader(HttpHeaders.AUTHORIZATION);
    if (!StringUtils.hasText(header) || !header.startsWith("Bearer ")) {
      filterChain.doFilter(request, response);
      return;
    }
    String token = header.substring(7).trim();
    jwtService
        .parseOptional(token)
        .ifPresent(
            claims -> {
              String subject = claims.getSubject();
              if (!StringUtils.hasText(subject)) {
                return;
              }
              List<SimpleGrantedAuthority> authorities = mapAuthorities(claims);
              var auth =
                  new UsernamePasswordAuthenticationToken(
                      subject, null, authorities);
              SecurityContextHolder.getContext().setAuthentication(auth);
            });
    filterChain.doFilter(request, response);
  }

  private static List<SimpleGrantedAuthority> mapAuthorities(Claims claims) {
    List<String> roles = JwtService.rolesFromClaims(claims);
    List<SimpleGrantedAuthority> out = new ArrayList<>();
    for (String r : roles) {
      if (!StringUtils.hasText(r)) {
        continue;
      }
      String a = r.startsWith("ROLE_") ? r : "ROLE_" + r;
      out.add(new SimpleGrantedAuthority(a));
    }
    if (out.isEmpty()) {
      out.add(new SimpleGrantedAuthority("ROLE_USER"));
    }
    return out;
  }
}
