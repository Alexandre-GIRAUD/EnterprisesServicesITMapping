import { ReactNode } from 'react';
import flowraLogo from '@/assets/flowra.svg.svg';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="layout">
      <header className="layout-header">
        <div className="layout-brand">
          <img src={flowraLogo} alt="Flowra logo" className="layout-brand-logo" />
          <h1>Flowra.AI</h1>
        </div>
        {/* Auth placeholder: login / user menu when JWT is implemented */}
      </header>
      <main className="layout-main">{children}</main>
    </div>
  );
}
