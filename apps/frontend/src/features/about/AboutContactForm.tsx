import { type FormEvent, useState } from 'react';
import { buildContactMailLink } from './aboutContact';

const MESSAGE_ROWS = 5;

export function AboutContactForm() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  function sendContactEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.location.href = buildContactMailLink(subject, message);
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
