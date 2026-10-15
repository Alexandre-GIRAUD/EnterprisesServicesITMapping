import { type FormEvent, useState } from 'react';
import { buildContactMailHref, FLOWRA_SITE_URL } from './aboutContact';

const MESSAGE_ROWS = 5;

const MODES = [
  {
    title: 'Production',
    text: 'The shared cartography. What the organisation agrees is in the system.',
  },
  {
    title: 'Sandbox',
    text: 'A private copy. Rearrange it, then keep only what you decide to save.',
  },
  {
    title: 'My views',
    text: 'The diagrams you pin, filed so you can return to the same frame.',
  },
] as const;

function AboutModeList() {
  return (
    <ul className="about-modes">
      {MODES.map((mode) => (
        <li key={mode.title}>
          <strong>{mode.title}</strong>
          <p>{mode.text}</p>
        </li>
      ))}
    </ul>
  );
}

function AboutContactForm() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  function sendContactEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.location.href = buildContactMailHref(subject, message);
  }

  return (
    <form className="about-contact" onSubmit={sendContactEmail}>
      <h3>Contact</h3>
      <label>
        Subject
        <input value={subject} onChange={(event) => setSubject(event.target.value)} required />
      </label>
      <label>
        Message
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} required rows={MESSAGE_ROWS} />
      </label>
      <button type="submit">Send email</button>
    </form>
  );
}

export function AboutPage() {
  return (
    <main className="about-page">
      <p className="about-kicker">Flowra</p>
      <h2>The system, drawn once.</h2>
      <p className="about-lead">
        Flowra maps the applications in an information system and the flows between them.
      </p>
      <AboutModeList />
      {FLOWRA_SITE_URL ? (
        <p className="about-site">
          <a href={FLOWRA_SITE_URL}>Open the Flowra site</a>
        </p>
      ) : null}
      <AboutContactForm />
    </main>
  );
}
