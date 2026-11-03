package com.enterprise.itmapping.feature.referential.application;

import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.referential.domain.ReferentialMapping;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class ChatReferentialMappingProposer implements ReferentialMappingProposer {

  private static final int SAMPLE_CHARS = 20_000;

  private final ChatClient chatClient;
  private final ObjectMapper objectMapper;

  public ChatReferentialMappingProposer(ChatClient.Builder builder, ObjectMapper objectMapper) {
    this.chatClient = builder.build();
    this.objectMapper = objectMapper;
  }

  @Override
  public List<ReferentialMapping> propose(String sampleBody, List<DataModelField> fields) {
    if (fields.isEmpty()) {
      return List.of();
    }
    String sample = sampleBody.length() <= SAMPLE_CHARS ? sampleBody : sampleBody.substring(0, SAMPLE_CHARS);
    try {
      String content =
          chatClient
              .prompt()
              .system(
                  """
                  You map fields of one JSON object to Data Model attribute keys.
                  Reply with a JSON array only. Each item is {"path":"<dot.path>","fieldKey":"<key>"}.
                  Paths use dots for nested objects. Use only the attribute keys provided.
                  Skip a field when the sample has no convincing match.
                  """)
              .user(userMessage(sample, fields))
              .call()
              .content();
      return read(content, objectMapper);
    } catch (RuntimeException ex) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Mapping proposal failed.");
    }
  }

  static List<ReferentialMapping> read(String content, ObjectMapper mapper) {
    if (content == null || content.isBlank()) {
      return List.of();
    }
    int start = content.indexOf('[');
    int end = content.lastIndexOf(']');
    if (start < 0 || end <= start) {
      return List.of();
    }
    try {
      JsonNode tree = mapper.readTree(content.substring(start, end + 1));
      if (!tree.isArray()) {
        return List.of();
      }
      List<ReferentialMapping> mappings = new ArrayList<>();
      for (JsonNode item : tree) {
        if (item == null || !item.isObject()) {
          continue;
        }
        JsonNode path = item.get("path");
        JsonNode fieldKey = item.get("fieldKey");
        if (path == null || fieldKey == null || !path.isTextual() || !fieldKey.isTextual()) {
          continue;
        }
        mappings.add(new ReferentialMapping(path.asText(), fieldKey.asText()));
      }
      return mappings;
    } catch (Exception ex) {
      return List.of();
    }
  }

  private static String userMessage(String sample, List<DataModelField> fields) {
    StringBuilder message = new StringBuilder();
    message.append("Attributes:\n");
    for (DataModelField field : fields) {
      message.append("- ").append(field.key()).append(" (").append(field.label()).append(')');
      if (field.description() != null && !field.description().isBlank()) {
        message.append(": ").append(field.description().trim());
      }
      message.append('\n');
    }
    message.append("\nSample:\n").append(sample);
    return message.toString();
  }
}
