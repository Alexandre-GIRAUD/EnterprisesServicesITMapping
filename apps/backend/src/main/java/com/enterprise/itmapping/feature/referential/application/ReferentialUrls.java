package com.enterprise.itmapping.feature.referential.application;

import java.net.InetAddress;
import java.net.URI;
import java.net.URLEncoder;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Builds the call URL and refuses hosts that are not public HTTPS. */
final class ReferentialUrls {

  static final String PLACEHOLDER = "{externalKey}";

  private ReferentialUrls() {}

  static URI requestUri(String template, String externalKey) {
    String applied = apply(template, externalKey);
    URI uri;
    try {
      uri = URI.create(applied);
    } catch (IllegalArgumentException ex) {
      throw refuse("Referential URL is invalid.");
    }
    requirePublicHttps(uri);
    return uri;
  }

  static String apply(String template, String externalKey) {
    requireTemplate(template);
    String encoded = URLEncoder.encode(externalKey, StandardCharsets.UTF_8).replace("+", "%20");
    return template.replace(PLACEHOLDER, encoded);
  }

  private static void requireTemplate(String template) {
    if (template == null || template.isBlank()) {
      throw refuse("URL template must contain {externalKey} once.");
    }
    int first = template.indexOf(PLACEHOLDER);
    int last = template.lastIndexOf(PLACEHOLDER);
    long braces = template.chars().filter(ch -> ch == '{').count();
    if (first < 0 || first != last || braces != 1) {
      throw refuse("URL template must contain {externalKey} once.");
    }
  }

  private static void requirePublicHttps(URI uri) {
    if (uri.getScheme() == null || !uri.getScheme().equalsIgnoreCase("https")) {
      throw refuse("Referential URL must be HTTPS.");
    }
    if (uri.getUserInfo() != null || uri.getHost() == null || uri.getHost().isBlank()) {
      throw refuse("Referential URL must be a public HTTPS address.");
    }
    InetAddress[] addresses = resolve(uri.getHost());
    for (InetAddress address : addresses) {
      if (isBlocked(address)) {
        throw refuse("Referential URL must be a public HTTPS address.");
      }
    }
  }

  private static InetAddress[] resolve(String host) {
    try {
      return InetAddress.getAllByName(host);
    } catch (UnknownHostException ex) {
      throw refuse("Referential host could not be resolved.");
    }
  }

  private static boolean isBlocked(InetAddress address) {
    return address.isAnyLocalAddress()
        || address.isLoopbackAddress()
        || address.isLinkLocalAddress()
        || address.isSiteLocalAddress()
        || address.isMulticastAddress();
  }

  private static ResponseStatusException refuse(String message) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
  }
}
