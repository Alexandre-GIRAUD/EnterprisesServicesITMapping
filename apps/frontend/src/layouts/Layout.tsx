import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="layout">
      <header className="layout-header">
        <h1>Enterprise IT Mapping</h1>
        {/* Auth placeholder: login / user menu when JWT is implemented */}
      </header>
      <main className="layout-main">{children}</main>
    </div>
  );
}
