-- An account token now says what it does; an email change also carries the address to confirm.
ALTER TABLE account_tokens ADD COLUMN purpose VARCHAR(32) NOT NULL DEFAULT 'VERIFY_EMAIL';
ALTER TABLE account_tokens ALTER COLUMN purpose DROP DEFAULT;
ALTER TABLE account_tokens ADD COLUMN new_email VARCHAR(255) NULL;
