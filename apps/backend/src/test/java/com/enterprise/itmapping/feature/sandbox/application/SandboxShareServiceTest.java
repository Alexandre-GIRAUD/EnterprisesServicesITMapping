package com.enterprise.itmapping.feature.sandbox.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.enterprise.itmapping.feature.auth.application.CurrentUserResolver;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.sandbox.infrastructure.persistence.SharedSandboxEntity;
import com.enterprise.itmapping.feature.sandbox.infrastructure.persistence.SharedSandboxRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
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
class SandboxShareServiceTest {

  @Mock UserRepository userRepository;
  @Mock SharedSandboxRepository sharedSandboxRepository;
  @Mock CurrentUserResolver currentUserResolver;
  @Mock UserEntity sender;
  @Mock UserEntity recipient;

  @InjectMocks SandboxShareService sandboxShareService;

  private final UUID senderId = UUID.fromString("00000000-0000-0000-0000-000000000001");
  private final UUID recipientId = UUID.fromString("00000000-0000-0000-0000-000000000002");
  private final ObjectMapper objectMapper = new ObjectMapper();

  @BeforeEach
  void setUp() {
    when(currentUserResolver.requireCurrentUser()).thenReturn(sender);
  }

  @Test
  void shareStoresTheSavedDocumentForTheRecipient() throws Exception {
    when(sender.getId()).thenReturn(senderId);
    when(sender.getUsername()).thenReturn("alice");
    when(recipient.getId()).thenReturn(recipientId);
    when(userRepository.findByUsernameIgnoreCase("bob")).thenReturn(Optional.of(recipient));
    JsonNode document = objectMapper.readTree("{\"name\":\"Sketch\",\"note\":\"kept\"}");

    sandboxShareService.share(" bob ", " Sketch ", document);

    ArgumentCaptor<SharedSandboxEntity> saved = ArgumentCaptor.forClass(SharedSandboxEntity.class);
    verify(sharedSandboxRepository).save(saved.capture());
    assertEquals(recipient, saved.getValue().getRecipient());
    assertEquals("alice", saved.getValue().getSenderUsername());
    assertEquals("Sketch", saved.getValue().getName());
    assertEquals("kept", saved.getValue().getDocument().get("note").asText());
  }

  @Test
  void shareRejectsAnUnknownUsername() {
    when(userRepository.findByUsernameIgnoreCase("bob")).thenReturn(Optional.empty());

    assertThrows(
        ResponseStatusException.class,
        () -> sandboxShareService.share("bob", "Sketch", objectMapper.createObjectNode()));

    verify(sharedSandboxRepository, never()).save(any());
  }

  @Test
  void deleteRejectsAShareThatIsNotInTheInbox() {
    UUID shareId = UUID.fromString("00000000-0000-0000-0000-000000000010");
    when(sender.getId()).thenReturn(senderId);
    when(sharedSandboxRepository.findByIdAndRecipient_Id(shareId, senderId)).thenReturn(Optional.empty());

    assertThrows(ResponseStatusException.class, () -> sandboxShareService.deleteForCurrentUser(shareId));

    verify(sharedSandboxRepository, never()).delete(any());
  }
}
