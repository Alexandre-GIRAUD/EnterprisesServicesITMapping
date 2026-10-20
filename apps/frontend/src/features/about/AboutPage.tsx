import { FLOWRA_SITE_URL } from './aboutContact';
import { AboutContactForm } from './AboutContactForm';
import { FLOWRA_HEADLINE_LINES, FLOWRA_LEAD, FLOWRA_MODES } from './flowraIntro';

function AboutModeList() {
  return (
    <ul className="about-modes">
      {FLOWRA_MODES.map((mode) => (
        <li key={mode.title}>
          <strong>{mode.title}</strong>
          <p>{mode.text}</p>
        </li>
      ))}
    </ul>
  );
}

export function AboutPage() {
  return (
    <main className="about-page">
      <p className="about-kicker">Flowra</p>
      <h2>
        {FLOWRA_HEADLINE_LINES.map((line) => (
          <span key={line} className="auth-story-line">{line}</span>
        ))}
      </h2>
      <p className="about-lead">{FLOWRA_LEAD}</p>
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
