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

  /** AES-GCM ciphertext of the secret GitHub signs this workspace's webhook deliveries with. */
  @Column(name = "github_webhook_secret")
  private String githubWebhookSecret;

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

  public String getGitHubLogin() {
    return githubLogin;
  }

  public String getGitHubToken() {
    return githubToken;
  }

  public void connectGitHub(String login, String encryptedToken) {
    this.githubLogin = login;
    this.githubToken = encryptedToken;
  }

  public void disconnectGitHub() {
    connectGitHub(null, null);
  }

  public String getBitbucketUsername() {
    return bitbucketUsername;
  }

  public String getBitbucketToken() {
    return bitbucketToken;
  }

  public void disconnectBitbucket() {
    connectBitbucket(null, null);
  }

  public String getGitHubWebhookSecret() {
    return githubWebhookSecret;
  }

  public void setGitHubWebhookSecret(String encryptedSecret) {
    this.githubWebhookSecret = encryptedSecret;
  }

  public void connectBitbucket(String username, String encryptedToken) {
    this.bitbucketUsername = username;
    this.bitbucketToken = encryptedToken;
  }
}
