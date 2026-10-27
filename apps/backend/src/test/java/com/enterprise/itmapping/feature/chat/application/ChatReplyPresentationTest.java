package com.enterprise.itmapping.feature.chat.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.enterprise.itmapping.feature.chat.domain.ChatCitationType;
import com.enterprise.itmapping.feature.chat.presentation.dto.ChatAskResponse.ChatCitationDto;
import java.util.List;
import org.junit.jupiter.api.Test;

class ChatReplyPresentationTest {

  @Test
  void answerDropsEdgeIdsAndTheApplicationIdInSources() {
    String answer =
        """
        Here are the connections related to datahub with a daily frequency:

        ### Outbound Connections
        - To pnl
        - Data: PV
        - Frequency: Daily
        - Edge ID: e38f158a-23ce-4217-a48f-e411d55a2626

        Sources - Application: datahub (ID: 62e3bf2a-325b-4752-a699-d205471ad42a)
        """;

    String cleaned = ChatReplyPresentation.withoutTechnicalIds(answer);

    assertThat(cleaned).doesNotContain("e38f158a").doesNotContain("62e3bf2a");
    assertThat(cleaned).doesNotContain("Edge ID").doesNotContain("(ID:");
    assertThat(cleaned).contains("To pnl").contains("Sources - Application: datahub");
  }

  @Test
  void aFlowQuestionKeepsOnlyEdges() {
    List<ChatCitationDto> citations =
        List.of(
            new ChatCitationDto(ChatCitationType.APPLICATION, "app-1", "datahub"),
            new ChatCitationDto(ChatCitationType.EDGE, "edge-1", "datahub → pnl"),
            new ChatCitationDto(ChatCitationType.APPLICATION, "app-2", "pnl"));

    List<ChatCitationDto> shown =
        ChatReplyPresentation.citationsForQuestion(
            "connections related to datahub with a daily frequency", citations);

    assertThat(shown).extracting(ChatCitationDto::type).containsExactly(ChatCitationType.EDGE);
    assertThat(shown).extracting(ChatCitationDto::label).containsExactly("datahub → pnl");
  }

  @Test
  void anApplicationQuestionKeepsOnlyApplications() {
    List<ChatCitationDto> citations =
        List.of(
            new ChatCitationDto(ChatCitationType.APPLICATION, "app-1", "datahub"),
            new ChatCitationDto(ChatCitationType.EDGE, "edge-1", "datahub → pnl"));

    List<ChatCitationDto> shown =
        ChatReplyPresentation.citationsForQuestion("which applications handle payments", citations);

    assertThat(shown).extracting(ChatCitationDto::label).containsExactly("datahub");
  }

  @Test
  void anEdgeIsShownOnlyWhenTheAnswerNamesBothEnds() {
    String answer =
        """
        Here are the connections of "datahub" that have a daily frequency:
        Outbound connections:
        To pnl:
        Data: PV
        Frequency: daily
        To regulatory:
        Data: trade
        Frequency: daily
        Inbound connections:
        From booking:
        Data: cashflow
        Frequency: daily
        """;
    List<ChatCitationDto> citations =
        List.of(
            new ChatCitationDto(ChatCitationType.EDGE, "e1", "datahub → pnl"),
            new ChatCitationDto(ChatCitationType.EDGE, "e2", "datahub → regulatory"),
            new ChatCitationDto(ChatCitationType.EDGE, "e3", "booking → datahub"),
            new ChatCitationDto(ChatCitationType.EDGE, "e4", "datahub → trading-pricing"),
            new ChatCitationDto(ChatCitationType.EDGE, "e5", "analytics → datahub"));

    List<ChatCitationDto> shown =
        ChatReplyPresentation.citationsMentionedInAnswer(answer, citations);

    assertThat(shown)
        .extracting(ChatCitationDto::label)
        .containsExactly("datahub → pnl", "datahub → regulatory", "booking → datahub");
  }
}
