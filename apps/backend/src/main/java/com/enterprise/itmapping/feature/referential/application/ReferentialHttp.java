package com.enterprise.itmapping.feature.referential.application;

import java.net.URI;

/** GET against one already-checked referential URL. The secret stays in the header. */
public interface ReferentialHttp {

  String get(URI uri, String headerName, String secret);
}
