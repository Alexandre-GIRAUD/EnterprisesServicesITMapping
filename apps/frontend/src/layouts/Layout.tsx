import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import flowraLogo from '@/assets/flowra.svg.svg';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="layout">
      <header className="layout-header">
        <Link to="/map" className="layout-brand layout-brand-link">
          <img src={flowraLogo} alt="" className="layout-brand-logo" aria-hidden />
          <h1>Flowra.AI</h1>
        </Link>
        {/* Auth placeholder: login / user menu when JWT is implemented */}
      </header>
      <main className="layout-main">{children}</main>
    </div>
  );
}
