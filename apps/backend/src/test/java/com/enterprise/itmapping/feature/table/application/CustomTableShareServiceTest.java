package com.enterprise.itmapping.feature.table.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.auth.application.CurrentUserResolver;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.table.CustomTableShareLimits;
import com.enterprise.itmapping.feature.table.infrastructure.persistence.SharedCustomTableEntity;
import com.enterprise.itmapping.feature.table.infrastructure.persistence.SharedCustomTableRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class CustomTableShareServiceTest {

  @Mock UserRepository userRepository;
  @Mock SharedCustomTableRepository sharedCustomTableRepository;
  @Mock CurrentUserResolver currentUserResolver;
  @Mock UserEntity sender;
  @Mock UserEntity recipient;

  @InjectMocks CustomTableShareService customTableShareService;

  private final UUID senderId = UUID.fromString("00000000-0000-0000-0000-000000000001");
  private final UUID recipientId = UUID.fromString("00000000-0000-0000-0000-000000000002");
  private final ObjectMapper objectMapper = new ObjectMapper();

  @BeforeEach
  void setUp() {
    when(currentUserResolver.requireCurrentUser()).thenReturn(sender);
  }

  @Test
  void shareStoresACopyForTheRecipient() throws Exception {
    when(sender.getId()).thenReturn(senderId);
    when(sender.getUsername()).thenReturn("alice");
    when(recipient.getId()).thenReturn(recipientId);
    when(userRepository.findByUsernameIgnoreCase("bob")).thenReturn(Optional.of(recipient));
    JsonNode document = objectMapper.readTree("{\"name\":\"Regions\",\"row\":null}");

    customTableShareService.share(" bob ", " Regions ", document);

    ArgumentCaptor<SharedCustomTableEntity> saved = ArgumentCaptor.forClass(SharedCustomTableEntity.class);
    verify(sharedCustomTableRepository).save(saved.capture());
    assertEquals(recipient, saved.getValue().getRecipient());
    assertEquals("alice", saved.getValue().getSenderUsername());
    assertEquals("Regions", saved.getValue().getName());
    assertEquals("Regions", saved.getValue().getDocument().get("name").asText());
  }

  @Test
  void shareRejectsAnUnknownUsername() {
    when(userRepository.findByUsernameIgnoreCase("bob")).thenReturn(Optional.empty());

    ResponseStatusException unknownUser =
        assertThrows(
            ResponseStatusException.class,
            () -> customTableShareService.share("bob", "Regions", objectMapper.createObjectNode()));
    assertEquals("No user with that username.", unknownUser.getReason());

    verify(sharedCustomTableRepository, never()).save(any());
  }

  @Test
  void shareRejectsSharingWithYourself() {
    when(sender.getId()).thenReturn(senderId);
    when(userRepository.findByUsernameIgnoreCase("alice")).thenReturn(Optional.of(sender));

    ResponseStatusException selfShare =
        assertThrows(
            ResponseStatusException.class,
            () -> customTableShareService.share("alice", "Regions", objectMapper.createObjectNode()));
    assertEquals("You cannot share with yourself.", selfShare.getReason());

    verify(sharedCustomTableRepository, never()).save(any());
  }

  @Test
  void shareRejectsABlankName() {
    when(sender.getId()).thenReturn(senderId);
    when(recipient.getId()).thenReturn(recipientId);
    when(userRepository.findByUsernameIgnoreCase("bob")).thenReturn(Optional.of(recipient));

    assertThrows(
        ResponseStatusException.class,
        () -> customTableShareService.share("bob", "  ", objectMapper.createObjectNode()));

    verify(sharedCustomTableRepository, never()).save(any());
  }

  @Test
  void deleteRejectsAShareThatIsNotInTheInbox() {
    UUID shareId = UUID.fromString("00000000-0000-0000-0000-000000000010");
    when(sender.getId()).thenReturn(senderId);
    when(sharedCustomTableRepository.findByIdAndRecipient_Id(shareId, senderId)).thenReturn(Optional.empty());

    assertThrows(ResponseStatusException.class, () -> customTableShareService.deleteForCurrentUser(shareId));

    verify(sharedCustomTableRepository, never()).delete(any());
  }

  @Test
  void shareRejectsAnOversizedDocument() throws Exception {
    when(sender.getId()).thenReturn(senderId);
    when(recipient.getId()).thenReturn(recipientId);
    when(userRepository.findByUsernameIgnoreCase("bob")).thenReturn(Optional.of(recipient));
    String oversized = "x".repeat(CustomTableShareService.MAX_DOCUMENT_CHARS);
    JsonNode document = objectMapper.readTree("{\"body\":\"" + oversized + "\"}");

    ResponseStatusException tooLarge =
        assertThrows(
            ResponseStatusException.class,
            () -> customTableShareService.share("bob", "Regions", document));

    assertEquals("That table is too large to share.", tooLarge.getReason());
    verify(sharedCustomTableRepository, never()).save(any());
  }

  @Test
  void shareRejectsAMissingDocument() {
    when(sender.getId()).thenReturn(senderId);
    when(recipient.getId()).thenReturn(recipientId);
    when(userRepository.findByUsernameIgnoreCase("bob")).thenReturn(Optional.of(recipient));

    ResponseStatusException missing =
        assertThrows(ResponseStatusException.class, () -> customTableShareService.share("bob", "Regions", null));

    assertEquals("A document is required.", missing.getReason());
    verify(sharedCustomTableRepository, never()).save(any());
  }

  @Test
  void shareRejectsABlankUsername() {
    when(sender.getId()).thenReturn(senderId);

    ResponseStatusException blank =
        assertThrows(ResponseStatusException.class, () -> customTableShareService.share("  ", "Regions", objectMapper.createObjectNode()));

    assertEquals("A username is required.", blank.getReason());
  }

  @Test
  void shareRejectsAnOverlongName() {
    when(sender.getId()).thenReturn(senderId);
    when(recipient.getId()).thenReturn(recipientId);
    when(userRepository.findByUsernameIgnoreCase("bob")).thenReturn(Optional.of(recipient));

    ResponseStatusException tooLong =
        assertThrows(
            ResponseStatusException.class,
            () -> customTableShareService.share("bob", "n".repeat(CustomTableShareLimits.MAX_NAME_LENGTH + 1), objectMapper.createObjectNode()));

    assertEquals("That name is too long.", tooLong.getReason());
    verify(sharedCustomTableRepository, never()).save(any());
  }

  @Test
  void listReturnsSharesForTheCurrentUser() {
    when(sender.getId()).thenReturn(senderId);
    SharedCustomTableEntity entity = new SharedCustomTableEntity();
    entity.setName("Regions");
    entity.setSenderUsername("alice");
    entity.setDocument(objectMapper.createObjectNode());
    when(sharedCustomTableRepository.findByRecipient_IdOrderByCreatedAtAsc(senderId)).thenReturn(List.of(entity));

    assertEquals("Regions", customTableShareService.listForCurrentUser().get(0).name());
  }

  @Test
  void deleteRemovesAShareInTheInbox() {
    UUID shareId = UUID.fromString("00000000-0000-0000-0000-000000000011");
    when(sender.getId()).thenReturn(senderId);
    SharedCustomTableEntity entity = new SharedCustomTableEntity();
    when(sharedCustomTableRepository.findByIdAndRecipient_Id(shareId, senderId)).thenReturn(Optional.of(entity));

    customTableShareService.deleteForCurrentUser(shareId);

    verify(sharedCustomTableRepository).delete(entity);
  }
}
