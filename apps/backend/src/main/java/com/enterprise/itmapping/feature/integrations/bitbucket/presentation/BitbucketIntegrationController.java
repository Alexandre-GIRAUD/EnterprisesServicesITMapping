package com.enterprise.itmapping.feature.integrations.bitbucket.presentation;

import com.enterprise.itmapping.feature.auth.application.CurrentUserResolver;
import com.enterprise.itmapping.feature.integrations.bitbucket.application.BitbucketAccountService;
import com.enterprise.itmapping.feature.integrations.bitbucket.application.BitbucketConnectionStatus;
import com.enterprise.itmapping.feature.integrations.bitbucket.application.BitbucketReposService;
import com.enterprise.itmapping.feature.integrations.bitbucket.dto.BitbucketRepoDto;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/integrations/bitbucket")
public class BitbucketIntegrationController {

  private final BitbucketReposService repos;
  private final BitbucketAccountService accounts;
  private final CurrentUserResolver currentUser;

  public BitbucketIntegrationController(
      BitbucketReposService repos, BitbucketAccountService accounts, CurrentUserResolver currentUser) {
    this.repos = repos;
    this.accounts = accounts;
    this.currentUser = currentUser;
  }

  @GetMapping("/connection")
  public BitbucketConnectionStatus connection() {
    return accounts.status(currentUser.requireCurrentUser());
  }

  @PutMapping("/connection")
  public BitbucketConnectionStatus saveToken(@RequestBody BitbucketTokenRequest body) {
    return accounts.saveToken(currentUser.requireCurrentUser(), body == null ? null : body.token());
  }

  @DeleteMapping("/connection")
  public void disconnect() {
    accounts.disconnect(currentUser.requireCurrentUser());
  }

  @GetMapping("/repos")
  public List<BitbucketRepoDto> listRepos() {
    return repos.listUserRepos();
  }

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<Map<String, String>> bitbucketError(ResponseStatusException ex) {
    String message = ex.getReason() == null ? "" : ex.getReason();
    return ResponseEntity.status(ex.getStatusCode()).body(Map.of("message", message));
  }
}

record BitbucketTokenRequest(String token) {}
