package com.enterprise.itmapping.feature.integrations.github;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.junit.jupiter.api.Test;

class GitHubReadmeFileBodyDecoderTest {

  private final ObjectMapper mapper = new ObjectMapper();

  @Test
  void decodesBase64FilePayload() throws Exception {
    String text = "# Hello\nWorld";
    String b64 = Base64.getEncoder().encodeToString(text.getBytes(StandardCharsets.UTF_8));
    String json =
        """
        {"type":"file","encoding":"base64","content":"%s"}
        """
            .formatted(b64);
    assertThat(GitHubReadmeFileBodyDecoder.decodeUtf8Plaintext(mapper.readTree(json)))
        .contains(text);
  }

  @Test
  void rejectsDirectoryPayload() throws Exception {
    String json = "{\"type\":\"dir\"}";
    assertThat(GitHubReadmeFileBodyDecoder.decodeUtf8Plaintext(mapper.readTree(json))).isEmpty();
  }
}
