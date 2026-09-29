package com.enterprise.itmapping.feature.sandbox.application;

import com.enterprise.itmapping.feature.auth.application.CurrentUserResolver;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.sandbox.infrastructure.persistence.SharedSandboxEntity;
import com.enterprise.itmapping.feature.sandbox.infrastructure.persistence.SharedSandboxRepository;
import com.enterprise.itmapping.feature.sandbox.presentation.dto.SandboxShareResponse;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SandboxShareService {

  static final int MAX_DOCUMENT_CHARS = 1_048_576;

  private final UserRepository userRepository;
  private final SharedSandboxRepository sharedSandboxRepository;
  private final CurrentUserResolver currentUserResolver;

  public SandboxShareService(
      UserRepository userRepository,
      SharedSandboxRepository sharedSandboxRepository,
      CurrentUserResolver currentUserResolver) {
    this.userRepository = userRepository;
    this.sharedSandboxRepository = sharedSandboxRepository;
    this.currentUserResolver = currentUserResolver;
  }

  @Transactional
  public void share(String rawUsername, String rawName, JsonNode document) {
    UserEntity sender = currentUserResolver.requireCurrentUser();
    UserEntity recipient = requireRecipient(sender, rawUsername);
    String name = normalizeName(rawName);
    if (document == null || document.isNull()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le document est obligatoire.");
    }
    if (document.toString().length() > MAX_DOCUMENT_CHARS) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le sandbox est trop volumineux.");
    }
    SharedSandboxEntity copy = new SharedSandboxEntity();
    copy.setRecipient(recipient);
    copy.setSenderUsername(sender.getUsername());
    copy.setName(name);
    copy.setDocument(document);
    sharedSandboxRepository.save(copy);
  }

  @Transactional(readOnly = true)
  public List<SandboxShareResponse> listForCurrentUser() {
    UserEntity recipient = currentUserResolver.requireCurrentUser();
    return sharedSandboxRepository.findByRecipient_IdOrderByCreatedAtAsc(recipient.getId()).stream()
        .map(entity -> new SandboxShareResponse(entity.getId(), entity.getName(), entity.getSenderUsername(), entity.getDocument()))
        .toList();
  }

  @Transactional
  public void deleteForCurrentUser(UUID id) {
    UserEntity recipient = currentUserResolver.requireCurrentUser();
    SharedSandboxEntity entity =
        sharedSandboxRepository
            .findByIdAndRecipient_Id(id, recipient.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sandbox partagé introuvable."));
    sharedSandboxRepository.delete(entity);
  }

  private UserEntity requireRecipient(UserEntity sender, String rawUsername) {
    if (!StringUtils.hasText(rawUsername)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nom d'utilisateur est obligatoire.");
    }
    UserEntity recipient =
        userRepository
            .findByUsernameIgnoreCase(rawUsername.trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Utilisateur introuvable."));
    if (recipient.getId().equals(sender.getId())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vous ne pouvez pas partager avec vous-même.");
    }
    return recipient;
  }

  private static String normalizeName(String raw) {
    if (!StringUtils.hasText(raw)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nom est obligatoire.");
    }
    String trimmed = raw.trim();
    if (trimmed.length() > 80) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nom ne peut pas dépasser 80 caractères.");
    }
    return trimmed;
  }
}
