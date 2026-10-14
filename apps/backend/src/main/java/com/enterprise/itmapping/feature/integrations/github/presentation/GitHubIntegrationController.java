package com.enterprise.itmapping.feature.integrations.github.presentation;

import com.enterprise.itmapping.feature.auth.application.CurrentUserResolver;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubAccountService;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubConnectionStatus;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubReposService;
import com.enterprise.itmapping.feature.integrations.github.dto.GitHubRepoDto;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.view.RedirectView;

@RestController
@RequestMapping("/integrations/github")
public class GitHubIntegrationController {

  private final GitHubReposService gitHubReposService;
  private final GitHubAccountService accounts;
  private final CurrentUserResolver currentUser;

  public GitHubIntegrationController(
      GitHubReposService gitHubReposService,
      GitHubAccountService accounts,
      CurrentUserResolver currentUser) {
    this.gitHubReposService = gitHubReposService;
    this.accounts = accounts;
    this.currentUser = currentUser;
  }

  /** Starts OAuth. The browser is sent to the returned GitHub URL. */
  @GetMapping("/connect")
  public Map<String, String> connect() {
    return Map.of("authorizeUrl", accounts.begin(currentUser.requireCurrentUser()));
  }

  @GetMapping("/connection")
  public GitHubConnectionStatus connection() {
    return accounts.status(currentUser.requireCurrentUser());
  }

  @PutMapping("/connection")
  public GitHubConnectionStatus saveToken(@RequestBody GitHubTokenRequest body) {
    return accounts.saveToken(currentUser.requireCurrentUser(), body == null ? null : body.token());
  }

  @DeleteMapping("/connection")
  public void disconnect() {
    accounts.disconnect(currentUser.requireCurrentUser());
  }

  /** GitHub redirects the browser here. No Flowra session is present on this request. */
  @GetMapping("/callback")
  public RedirectView callback(
      @RequestParam(required = false) String code, @RequestParam(required = false) String state) {
    String flag = "connected";
    try {
      if (!StringUtils.hasText(code) || !StringUtils.hasText(state)) {
        flag = "denied";
      } else {
        accounts.finish(state, code);
      }
    } catch (ResponseStatusException ex) {
      flag = "failed";
    }
    RedirectView view = new RedirectView(accounts.returnUrl(flag));
    view.setContextRelative(false);
    return view;
  }

  /**
   * Proxies GitHub {@code GET /user/repos} using the server-configured token.
   */
  @GetMapping("/repos")
  public List<GitHubRepoDto> listRepos() {
    return gitHubReposService.listUserRepos();
  }

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<Map<String, String>> githubError(ResponseStatusException ex) {
    String message = ex.getReason() == null ? "" : ex.getReason();
    return ResponseEntity.status(ex.getStatusCode()).body(Map.of("message", message));
  }
}

record GitHubTokenRequest(String token) {}
