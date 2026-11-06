-- One table for every emailed account link: email verification, password reset, email change.
ALTER TABLE email_verification_tokens RENAME TO account_tokens;
ALTER INDEX idx_email_verification_tokens_user RENAME TO idx_account_tokens_user;
