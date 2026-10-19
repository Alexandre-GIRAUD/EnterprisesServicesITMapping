package com.enterprise.itmapping.feature.table.application;

import com.enterprise.itmapping.feature.auth.application.CurrentUserResolver;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserEntity;
import com.enterprise.itmapping.feature.auth.infrastructure.persistence.UserRepository;
import com.enterprise.itmapping.feature.table.CustomTableShareLimits;
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
  static final int MAX_NAME_LENGTH = CustomTableShareLimits.MAX_NAME_LENGTH;
  static final String DOCUMENT_REQUIRED = "A document is required.";
  static final String DOCUMENT_TOO_LARGE = "That table is too large to share.";
  static final String USER_NOT_FOUND = "No user with that username.";
  static final String CANNOT_SHARE_WITH_YOURSELF = "You cannot share with yourself.";
  static final String USERNAME_REQUIRED = "A username is required.";
  static final String NAME_REQUIRED = "A name is required.";
  static final String NAME_TOO_LONG = "That name is too long.";
  static final String SHARE_NOT_FOUND = "That shared table is not in the inbox.";

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
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, DOCUMENT_REQUIRED);
    }
    if (document.toString().length() > MAX_DOCUMENT_CHARS) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, DOCUMENT_TOO_LARGE);
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
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, SHARE_NOT_FOUND));
    sharedCustomTableRepository.delete(entity);
  }

  private UserEntity requireRecipient(UserEntity sender, String rawUsername) {
    if (!StringUtils.hasText(rawUsername)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, USERNAME_REQUIRED);
    }
    UserEntity recipient =
        userRepository
            .findByUsernameIgnoreCase(rawUsername.trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, USER_NOT_FOUND));
    if (recipient.getId().equals(sender.getId())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, CANNOT_SHARE_WITH_YOURSELF);
    }
    return recipient;
  }

  private static String normalizeName(String raw) {
    if (!StringUtils.hasText(raw)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, NAME_REQUIRED);
    }
    String trimmed = raw.trim();
    if (trimmed.length() > MAX_NAME_LENGTH) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, NAME_TOO_LONG);
    }
    return trimmed;
  }
}
