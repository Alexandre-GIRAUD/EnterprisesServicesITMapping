package com.enterprise.itmapping.feature.integrations.bitbucket.application;

import com.enterprise.itmapping.feature.integrations.bitbucket.BitbucketApiClient;
import com.enterprise.itmapping.feature.integrations.bitbucket.dto.BitbucketRepoDto;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

@Service
public class BitbucketReposService {

  private final BitbucketApiClient apiClient;

  public BitbucketReposService(BitbucketApiClient apiClient) {
    this.apiClient = apiClient;
  }

  /** First page of repositories the token can access, most recently updated first. */
  public List<BitbucketRepoDto> listUserRepos() {
    if (!apiClient.hasToken()) {
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE,
          "Connect your Bitbucket account in Settings, or set BITBUCKET_TOKEN on the server.");
    }
    String uri =
        String.format(
            Locale.ROOT, "/repositories?role=member&pagelen=%d&sort=-updated_on", apiClient.maxRepos());
    try {
      RepoPage page =
          apiClient
              .buildClient()
              .get()
              .uri(uri)
              .accept(MediaType.APPLICATION_JSON)
              .retrieve()
              .body(RepoPage.class);
      if (page == null || page.values() == null) {
        return List.of();
      }
      return page.values().stream().map(BitbucketReposService::toDto).toList();
    } catch (RestClientResponseException ex) {
      int code = ex.getStatusCode().value();
      if (code == 401 || code == 403) {
        throw new ResponseStatusException(
            HttpStatus.BAD_GATEWAY, "Bitbucket rejected the token. Reconnect the account in Settings.");
      }
      String body = ex.getResponseBodyAsString(StandardCharsets.UTF_8);
      throw new ResponseStatusException(
          HttpStatus.BAD_GATEWAY, "Bitbucket repository list failed (" + code + "). " + trim(body));
    }
  }

  private static BitbucketRepoDto toDto(RepoJson repo) {
    String fullName = repo.fullName() != null ? repo.fullName() : repo.name();
    String html = repo.links() != null && repo.links().html() != null ? repo.links().html().href() : "";
    return new BitbucketRepoDto(
        repo.uuid() != null ? repo.uuid() : fullName,
        fullName != null ? fullName : "",
        repo.name() != null ? repo.name() : "",
        repo.description() != null ? repo.description() : "",
        html != null ? html : "",
        repo.repoPrivate());
  }

  private static String trim(String body) {
    if (body == null) {
      return "";
    }
    return body.length() > 400 ? body.substring(0, 400) + "…" : body;
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  private record RepoPage(List<RepoJson> values) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  private record RepoJson(
      String uuid,
      String name,
      @JsonProperty("full_name") String fullName,
      String description,
      @JsonProperty("is_private") boolean repoPrivate,
      RepoLinks links) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  private record RepoLinks(RepoLink html) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  private record RepoLink(String href) {}
}
