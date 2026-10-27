package com.enterprise.itmapping.feature.chat.application;

import com.enterprise.itmapping.feature.chat.domain.ChatCitationType;
import com.enterprise.itmapping.feature.chat.presentation.dto.ChatAskResponse.ChatCitationDto;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/** Hides technical ids in an answer and keeps citation chips that match the question. */
final class ChatReplyPresentation {

  private static final Pattern UUID =
      Pattern.compile(
          "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");
  private static final Pattern PAREN_ID =
      Pattern.compile("(?i)\\(\\s*id\\s*:\\s*(?:" + UUID.pattern() + ")?\\s*\\)");
  private static final Pattern ID_LINE =
      Pattern.compile(
          "(?im)^[ \\t]*[-*]?[ \\t]*(?:edge[ \\t]+|application[ \\t]+|app[ \\t]+)?id[ \\t]*:[ \\t]*(?:"
              + UUID.pattern()
              + ")?[ \\t]*$");
  private static final Pattern FLOW_QUESTION =
      Pattern.compile(
          "\\b(flux|connexions?|connections?|flows?|liens?|edges?)\\b", Pattern.CASE_INSENSITIVE);
  private static final Pattern APP_QUESTION =
      Pattern.compile("\\b(applications?|apps?)\\b", Pattern.CASE_INSENSITIVE);
  private static final Pattern EDGE_ARROW = Pattern.compile("\\s*(?:→|->)\\s*");

  private ChatReplyPresentation() {}

  static String withoutTechnicalIds(String answer) {
    if (answer == null || answer.isBlank()) {
      return answer == null ? "" : answer.trim();
    }
    String text = PAREN_ID.matcher(answer).replaceAll("");
    text = ID_LINE.matcher(text).replaceAll("");
    text = UUID.matcher(text).replaceAll("");
    text = text.replaceAll("[ \\t]+\\n", "\n");
    text = text.replaceAll("\\n{3,}", "\n\n");
    return text.trim();
  }

  static List<ChatCitationDto> citationsForQuestion(
      String question, List<ChatCitationDto> citations) {
    if (citations == null || citations.isEmpty()) {
      return List.of();
    }
    boolean asksForFlows = question != null && FLOW_QUESTION.matcher(question).find();
    boolean asksForApps = question != null && APP_QUESTION.matcher(question).find();
    if (asksForFlows == asksForApps) {
      return List.copyOf(citations);
    }
    ChatCitationType kept = asksForFlows ? ChatCitationType.EDGE : ChatCitationType.APPLICATION;
    return citations.stream().filter(citation -> citation.type() == kept).toList();
  }

  /** Drops chips whose names are absent from the answer, so unmentioned links stay hidden. */
  static List<ChatCitationDto> citationsMentionedInAnswer(
      String answer, List<ChatCitationDto> citations) {
    if (citations == null || citations.isEmpty() || answer == null || answer.isBlank()) {
      return List.of();
    }
    String text = answer.toLowerCase(Locale.ROOT);
    return citations.stream().filter(citation -> mentioned(text, citation)).toList();
  }

  private static boolean mentioned(String answer, ChatCitationDto citation) {
    if (citation.type() != ChatCitationType.EDGE) {
      return containsName(answer, citation.label());
    }
    String[] ends = edgeEnds(citation.label());
    if (ends == null) {
      return containsName(answer, citation.label());
    }
    return containsName(answer, ends[0]) && containsName(answer, ends[1]);
  }

  private static String[] edgeEnds(String label) {
    if (label == null) {
      return null;
    }
    String[] parts = EDGE_ARROW.split(label);
    if (parts.length != 2 || parts[0].isBlank() || parts[1].isBlank()) {
      return null;
    }
    return new String[] {parts[0].trim(), parts[1].trim()};
  }

  private static boolean containsName(String answerLower, String name) {
    if (name == null || name.isBlank()) {
      return false;
    }
    String needle = Pattern.quote(name.trim().toLowerCase(Locale.ROOT));
    Pattern namePattern = Pattern.compile("(?<![\\p{L}\\p{N}])" + needle + "(?![\\p{L}\\p{N}])");
    return namePattern.matcher(answerLower).find();
  }
}
