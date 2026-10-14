package com.enterprise.itmapping.feature.integrations.github.application;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/** AES-GCM for a GitHub access token. The key is the SHA-256 of the JWT secret. */
final class GitHubTokenCipher {

  private static final int IV_LENGTH = 12;
  private static final int TAG_BITS = 128;

  private GitHubTokenCipher() {}

  static String encrypt(String plain, String keyMaterial) {
    try {
      byte[] iv = new byte[IV_LENGTH];
      new SecureRandom().nextBytes(iv);
      Cipher cipher = cipher();
      cipher.init(Cipher.ENCRYPT_MODE, key(keyMaterial), new GCMParameterSpec(TAG_BITS, iv));
      byte[] encrypted = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
      byte[] packed = new byte[iv.length + encrypted.length];
      System.arraycopy(iv, 0, packed, 0, iv.length);
      System.arraycopy(encrypted, 0, packed, iv.length, encrypted.length);
      return Base64.getEncoder().encodeToString(packed);
    } catch (GeneralSecurityException e) {
      throw new IllegalStateException("GitHub token encryption failed.", e);
    }
  }

  static String decrypt(String packed, String keyMaterial) {
    try {
      byte[] raw = Base64.getDecoder().decode(packed);
      if (raw.length <= IV_LENGTH) {
        throw new IllegalArgumentException("Cipher text is too short.");
      }
      byte[] iv = Arrays.copyOfRange(raw, 0, IV_LENGTH);
      byte[] encrypted = Arrays.copyOfRange(raw, IV_LENGTH, raw.length);
      Cipher cipher = cipher();
      cipher.init(Cipher.DECRYPT_MODE, key(keyMaterial), new GCMParameterSpec(TAG_BITS, iv));
      return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
    } catch (GeneralSecurityException | IllegalArgumentException e) {
      throw new IllegalStateException("GitHub token decryption failed.", e);
    }
  }

  private static Cipher cipher() throws GeneralSecurityException {
    return Cipher.getInstance("AES/GCM/NoPadding");
  }

  private static SecretKeySpec key(String keyMaterial) throws NoSuchAlgorithmException {
    byte[] digest =
        MessageDigest.getInstance("SHA-256").digest(keyMaterial.getBytes(StandardCharsets.UTF_8));
    return new SecretKeySpec(digest, "AES");
  }
}
