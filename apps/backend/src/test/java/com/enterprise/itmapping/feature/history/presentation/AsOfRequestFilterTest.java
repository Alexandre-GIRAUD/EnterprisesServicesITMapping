package com.enterprise.itmapping.feature.history.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.history.application.PastSystemView;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.server.ResponseStatusException;

class AsOfRequestFilterTest {

  private final PastSystemView pastSystemView = mock(PastSystemView.class);
  private final AsOfRequestFilter filter = new AsOfRequestFilter(pastSystemView);
  private final MockHttpServletResponse response = new MockHttpServletResponse();
  private final MockFilterChain chain = new MockFilterChain();

  @Test
  void requestWithoutAsOfReadsTheLiveGraph() throws Exception {
    filter.doFilter(new MockHttpServletRequest("GET", "/graph"), response, chain);

    assertThat(chain.getRequest()).isNotNull();
    verifyNoInteractions(pastSystemView);
  }

  @Test
  void getWithAsOfRunsInsideThePastDayAndClosesIt() throws Exception {
    PastSystemView.Session session = mock(PastSystemView.Session.class);
    when(pastSystemView.open(LocalDate.of(2026, 3, 1))).thenReturn(session);

    filter.doFilter(get("2026-03-01"), response, chain);

    assertThat(chain.getRequest()).isNotNull();
    verify(session).close();
  }

  @Test
  void writeWithAsOfIsRefused() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest("POST", "/graph/edges");
    request.setParameter(AsOfRequestFilter.AS_OF_PARAM, "2026-03-01");

    filter.doFilter(request, response, chain);

    assertThat(response.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST.value());
    assertThat(chain.getRequest()).isNull();
  }

  @Test
  void malformedDateIsRefused() throws Exception {
    filter.doFilter(get("yesterday"), response, chain);

    assertThat(response.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST.value());
    assertThat(chain.getRequest()).isNull();
  }

  @Test
  void dayWithoutHistoryReturnsTheReason() throws Exception {
    when(pastSystemView.open(LocalDate.of(2000, 1, 1)))
        .thenThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST, "History starts on 2026-01-15"));

    filter.doFilter(get("2000-01-01"), response, chain);

    assertThat(response.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST.value());
    assertThat(response.getErrorMessage()).isEqualTo("History starts on 2026-01-15");
  }

  private static MockHttpServletRequest get(String asOf) {
    MockHttpServletRequest request = new MockHttpServletRequest("GET", "/graph");
    request.setParameter(AsOfRequestFilter.AS_OF_PARAM, asOf);
    return request;
  }
}
