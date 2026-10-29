import { useState, type FormEvent } from 'react';

/** Visual stand-in. The token stays in this field and is not sent anywhere. */
export function JiraTokenSettings() {
  const [personalToken, setPersonalToken] = useState('');

  function keepTokenLocal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <section className="admin-users-panel" aria-label="Jira token">
      <h2>Jira</h2>
      <p className="admin-users-lead">
        Paste a Jira API token. Nothing is sent or stored yet.
      </p>
      <form className="github-import-token-form" onSubmit={keepTokenLocal}>
        <input
          className="github-import-search-input"
          type="password"
          name="jira-token"
          autoComplete="off"
          placeholder="Jira token"
          aria-label="Jira token"
          value={personalToken}
          onChange={(event) => setPersonalToken(event.target.value)}
        />
        <button
          type="submit"
          className="github-import-primary"
          disabled={personalToken.trim().length === 0}
        >
          Save token
        </button>
      </form>
    </section>
  );
}
