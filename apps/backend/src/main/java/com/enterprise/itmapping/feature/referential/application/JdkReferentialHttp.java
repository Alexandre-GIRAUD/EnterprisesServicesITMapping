package com.enterprise.itmapping.feature.referential.application;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class JdkReferentialHttp implements ReferentialHttp {

  private static final Duration TIMEOUT = Duration.ofSeconds(10);

  private final HttpClient client =
      HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).connectTimeout(TIMEOUT).build();

  @Override
  public String get(URI uri, String headerName, String secret) {
    HttpRequest.Builder request =
        HttpRequest.newBuilder(uri).timeout(TIMEOUT).header("Accept", "application/json").GET();
    if (headerName != null && secret != null) {
      request.header(headerName, secret);
    }
    try {
      HttpResponse<String> response = client.send(request.build(), HttpResponse.BodyHandlers.ofString());
      int status = response.statusCode();
      if (status < 200 || status >= 300) {
        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Referential returned HTTP " + status + ".");
      }
      return response.body();
    } catch (InterruptedException ex) {
      Thread.currentThread().interrupt();
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Referential call was interrupted.");
    } catch (IOException ex) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Referential call failed.");
    }
  }
}
