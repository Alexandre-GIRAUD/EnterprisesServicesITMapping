package com.enterprise.itmapping.feature.workspace.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "workspaces")
public class WorkspaceEntity {

  @Id
  @Column(nullable = false, updatable = false)
  private UUID id;

  @Column(nullable = false, length = 128)
  private String name;

  @Column(name = "github_login")
  private String githubLogin;

  /** AES-GCM ciphertext of the workspace GitHub token. */
  @Column(name = "github_token")
  private String githubToken;

  @Column(name = "bitbucket_username")
  private String bitbucketUsername;

  /** AES-GCM ciphertext of the workspace Bitbucket token. */
  @Column(name = "bitbucket_token")
  private String bitbucketToken;

  protected WorkspaceEntity() {}

  public WorkspaceEntity(UUID id, String name) {
    this.id = id;
    this.name = name;
  }

  public UUID getId() {
    return id;
  }

  public String getName() {
    return name;
  }

  public String getGithubLogin() {
    return githubLogin;
  }

  public String getGithubToken() {
    return githubToken;
  }

  /** Both null to disconnect. */
  public void connectGitHub(String login, String encryptedToken) {
    this.githubLogin = login;
    this.githubToken = encryptedToken;
  }

  public String getBitbucketUsername() {
    return bitbucketUsername;
  }

  public String getBitbucketToken() {
    return bitbucketToken;
  }

  /** Both null to disconnect. */
  public void connectBitbucket(String username, String encryptedToken) {
    this.bitbucketUsername = username;
    this.bitbucketToken = encryptedToken;
  }
}
