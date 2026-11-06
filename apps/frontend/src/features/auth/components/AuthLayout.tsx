import type { ReactNode } from 'react';
import flowraLogo from '@/assets/flowra.svg';
import { FLOWRA_HEADLINE_LINES, FLOWRA_LEAD, FLOWRA_MODES } from '@/features/about/flowraIntro';

/** Signed-out pages: the Flowra story on the left, the given card on the right. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-split">
        <section className="auth-story">
          <header className="auth-brand">
            <img src={flowraLogo} alt="" className="auth-brand-logo" aria-hidden />
            <h1 className="auth-brand-title">Flowra</h1>
          </header>
          <h2>
            {FLOWRA_HEADLINE_LINES.map((line) => (
              <span key={line} className="auth-story-line">{line}</span>
            ))}
          </h2>
          <p className="auth-story-lead">{FLOWRA_LEAD}</p>
          <ul className="auth-story-modes">
            {FLOWRA_MODES.map((mode) => (
              <li key={mode.title}>
                <strong>{mode.title}</strong>
                <p>{mode.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <div className="auth-card">{children}</div>
      </div>
    </div>
  );
}
