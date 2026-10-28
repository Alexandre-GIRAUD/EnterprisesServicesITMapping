package com.enterprise.itmapping.feature.history.presentation;

import com.enterprise.itmapping.feature.history.application.PastSystemView;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.server.ResponseStatusException;

/**
 * {@code ?asOf=YYYY-MM-DD} on any GET answers as of that day. Runs after Spring Security, so only
 * signed-in requests reach the past view.
 */
@Component
public class AsOfRequestFilter extends OncePerRequestFilter {

  public static final String AS_OF_PARAM = "asOf";

  private final PastSystemView pastSystemView;

  public AsOfRequestFilter(PastSystemView pastSystemView) {
    this.pastSystemView = pastSystemView;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String asOf = request.getParameter(AS_OF_PARAM);
    if (!StringUtils.hasText(asOf)) {
      chain.doFilter(request, response);
      return;
    }
    if (!HttpMethod.GET.matches(request.getMethod())) {
      response.sendError(HttpStatus.BAD_REQUEST.value(), "A past view is read-only.");
      return;
    }
    LocalDate day;
    try {
      day = LocalDate.parse(asOf.trim());
    } catch (DateTimeParseException e) {
      response.sendError(HttpStatus.BAD_REQUEST.value(), "asOf must be a date like 2026-03-01.");
      return;
    }
    try (PastSystemView.Session ignored = pastSystemView.open(day)) {
      chain.doFilter(request, response);
    } catch (ResponseStatusException e) {
      response.sendError(e.getStatusCode().value(), e.getReason());
    }
  }
}
