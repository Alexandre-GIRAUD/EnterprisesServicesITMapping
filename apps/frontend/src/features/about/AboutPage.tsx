import { type FormEvent, useState } from 'react';
import { contactMailHref, FLOWRA_SITE_URL } from './aboutContact';

export function AboutPage() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.location.href = contactMailHref(subject, message);
  }

  return (
    <main className="about-page">
      <h2>Flowra</h2>
      <p>
        Flowra maps the applications in an information system and the flows between them.
        Production shows the shared cartography. Sandbox is a private copy you can rearrange.
        My views keeps the diagrams you pin.
      </p>
      {FLOWRA_SITE_URL ? (
        <p>
          <a href={FLOWRA_SITE_URL}>Open the Flowra site</a>
        </p>
      ) : null}
      <form className="about-contact" onSubmit={onSubmit}>
        <h3>Contact</h3>
        <label>
          Subject
          <input value={subject} onChange={(event) => setSubject(event.target.value)} required />
        </label>
        <label>
          Message
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} required rows={5} />
        </label>
        <button type="submit">Send email</button>
      </form>
    </main>
  );
}
