package com.enterprise.itmapping.feature.table.application;

import com.enterprise.itmapping.feature.auth.application.CurrentUserResolver;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.table.infrastructure.persistence.SharedCustomTableEntity;
import com.enterprise.itmapping.feature.table.infrastructure.persistence.SharedCustomTableRepository;
import com.enterprise.itmapping.feature.table.presentation.dto.CustomTableShareResponse;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CustomTableShareService {

  static final int MAX_DOCUMENT_CHARS = 262_144;

  private final UserRepository userRepository;
  private final SharedCustomTableRepository sharedCustomTableRepository;
  private final CurrentUserResolver currentUserResolver;

  public CustomTableShareService(
      UserRepository userRepository,
      SharedCustomTableRepository sharedCustomTableRepository,
      CurrentUserResolver currentUserResolver) {
    this.userRepository = userRepository;
    this.sharedCustomTableRepository = sharedCustomTableRepository;
    this.currentUserResolver = currentUserResolver;
  }

  @Transactional
  public void share(String rawUsername, String rawName, JsonNode document) {
    UserEntity sender = currentUserResolver.requireCurrentUser();
    UserEntity recipient = requireRecipient(sender, rawUsername);
    if (document == null || document.isNull()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le document est obligatoire.");
    }
    if (document.toString().length() > MAX_DOCUMENT_CHARS) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La table est trop volumineuse.");
    }
    SharedCustomTableEntity copy = new SharedCustomTableEntity();
    copy.setRecipient(recipient);
    copy.setSenderUsername(sender.getUsername());
    copy.setName(normalizeName(rawName));
    copy.setDocument(document);
    sharedCustomTableRepository.save(copy);
  }

  @Transactional(readOnly = true)
  public List<CustomTableShareResponse> listForCurrentUser() {
    UserEntity recipient = currentUserResolver.requireCurrentUser();
    return sharedCustomTableRepository.findByRecipient_IdOrderByCreatedAtAsc(recipient.getId()).stream()
        .map(entity -> new CustomTableShareResponse(entity.getId(), entity.getName(), entity.getSenderUsername(), entity.getDocument()))
        .toList();
  }

  @Transactional
  public void deleteForCurrentUser(UUID id) {
    UserEntity recipient = currentUserResolver.requireCurrentUser();
    SharedCustomTableEntity entity =
        sharedCustomTableRepository
            .findByIdAndRecipient_Id(id, recipient.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Table partagée introuvable."));
    sharedCustomTableRepository.delete(entity);
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
