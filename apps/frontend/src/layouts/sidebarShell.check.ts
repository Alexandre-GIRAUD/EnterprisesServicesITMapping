/**
 * Runnable self-check for the coherent sidebar shell.
 * Run: npx --yes tsx src/layouts/sidebarShell.check.ts
 */
import './cssHook.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mainNavigationEntries, profileInitial, profileRoleLabel } from './sidebarModel.ts';
import { nextMenuIndex, nextRovingIndex } from './sidebarRoving.ts';

const { SidebarNavItem } = await import('./SidebarNavItem.tsx');
const { SidebarProfile } = await import('./SidebarProfile.tsx');
const { ThemeToggle } = await import('./ThemeToggle.tsx');

const primaryLabels = mainNavigationEntries(true).map((entry) => entry.label);
assert.deepEqual(primaryLabels, ['Chatbot', 'Cartography', 'Data Model', 'Sources', 'Changes']);
assert.equal(mainNavigationEntries(true)[0]?.badge, 'IA');
assert.equal(mainNavigationEntries(true)[0]?.showSeparator, true);

const secondary = mainNavigationEntries(false);
assert.deepEqual(
  secondary.map((entry) => entry.label),
  ['Cartography', 'Data Model', 'Sources', 'Changes', 'Chatbot'],
);
assert.equal(secondary[0]?.label, 'Cartography');
assert.equal(secondary.at(-1)?.badge, undefined);
assert.equal(secondary.at(-1)?.showSeparator, false);

assert.equal(profileInitial(' ada '), 'A');
assert.equal(profileInitial('   '), '?');
assert.equal(profileRoleLabel(['ADMIN']), 'Admin');
assert.equal(profileRoleLabel(['ADMIN', 'USER']), 'Admin · User');
assert.equal(profileRoleLabel([]), null);
assert.equal(profileRoleLabel(['   ']), null);

assert.equal(nextRovingIndex(0, 4, 'ArrowDown'), 1);
assert.equal(nextRovingIndex(3, 4, 'ArrowDown'), 3);
assert.equal(nextRovingIndex(0, 4, 'ArrowUp'), 0);
assert.equal(nextRovingIndex(2, 4, 'ArrowUp'), 1);
assert.equal(nextRovingIndex(-1, 4, 'ArrowDown'), 0);
assert.equal(nextRovingIndex(2, 4, 'Home'), 0);
assert.equal(nextRovingIndex(2, 4, 'End'), 3);
assert.equal(nextRovingIndex(1, 4, 'Escape'), null);

assert.equal(nextMenuIndex(2, 3, 'ArrowDown'), 0);
assert.equal(nextMenuIndex(0, 3, 'ArrowUp'), 2);
assert.equal(nextMenuIndex(-1, 3, 'ArrowDown'), 0);
assert.equal(nextMenuIndex(0, 3, 'Tab'), 1);
assert.equal(nextMenuIndex(0, 3, 'Shift+Tab'), 2);
assert.equal(nextMenuIndex(1, 1, 'Tab'), 0);
assert.equal(nextMenuIndex(0, 2, 'Escape'), null);

const chatbot = renderToStaticMarkup(
  createElement(SidebarNavItem, {
    label: 'Chatbot',
    badge: 'IA',
    showSeparator: true,
    icon: null,
    onClick: () => undefined,
  }),
);
assert.match(chatbot, /class="sidebar-nav-item has-separator"/);
assert.match(chatbot, /class="sidebar-ia-badge"/);
assert.match(chatbot, />IA</);
assert.match(chatbot, /data-sidebar-item=""/);

const profile = renderToStaticMarkup(
  createElement(SidebarProfile, {
    username: 'ada',
    roles: ['ADMIN'],
    onSignOut: () => undefined,
  }),
);
assert.match(profile, /class="sidebar-avatar"/);
assert.match(profile, />A</);
assert.match(profile, />ada</);
assert.match(profile, /class="sidebar-profile-role"/);
assert.match(profile, />Admin</);
assert.doesNotMatch(profile, />ADMIN</);
assert.doesNotMatch(profile, /Sign out/);
assert.match(profile, /aria-haspopup="menu"/);
assert.match(profile, /aria-expanded="false"/);

const theme = renderToStaticMarkup(
  createElement(ThemeToggle, { theme: 'light', onToggle: () => undefined }),
);
assert.match(theme, /class="sidebar-theme-toggle"/);
assert.match(theme, /aria-label="Changer de thème"/);
assert.match(theme, /role="tooltip"/);
assert.match(theme, />Changer de thème</);
assert.match(theme, /<circle /);
const darkTheme = renderToStaticMarkup(
  createElement(ThemeToggle, { theme: 'dark', onToggle: () => undefined }),
);
assert.doesNotMatch(darkTheme, /<circle /);
assert.match(darkTheme, /aria-label="Changer de thème"/);

const layout = readFileSync(new URL('./Layout.tsx', import.meta.url), 'utf8');
const profileSource = readFileSync(new URL('./SidebarProfile.tsx', import.meta.url), 'utf8');
const nav = layout.slice(layout.indexOf('layout-sidebar-nav'), layout.indexOf('sidebar-footer'));
assert.doesNotMatch(nav, /SettingsMenu/);
assert.match(nav, /entry\.to === '\/map'/);
assert.doesNotMatch(layout, /Sign out/);
assert.doesNotMatch(layout, /layout-sidebar-role/);
assert.match(layout, /moveSidebarFocus/);
assert.match(profileSource, /Sign out/);
assert.match(profileSource, /role="menu"/);
assert.match(profileSource, /logOut/);
assert.match(profileSource, /Escape/);
assert.match(profileSource, /actions\.length > 0/);
assert.match(profileSource, /data-sidebar-menu/);

for (const fileName of ['SidebarNavItem.tsx', 'SidebarSubItem.tsx', 'SidebarProfile.tsx', 'ThemeToggle.tsx']) {
  const source = readFileSync(new URL(`./${fileName}`, import.meta.url), 'utf8');
  assert.match(source, /sidebarTokens\.css/);
}

const tokens = readFileSync(new URL('./sidebarTokens.css', import.meta.url), 'utf8');
for (const variable of [
  '--nav-item-height: 40px',
  '--nav-subitem-height: 32px',
  '--nav-gap: 4px',
  '--nav-padding-x: 12px',
  '--nav-section-gap: 16px',
  '--nav-logo-gap: 20px',
  '--radius-sm: 6px',
  '--radius-md: 8px',
  '--radius-full: 999px',
]) {
  assert.match(tokens, new RegExp(variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

const sidebarCss = readFileSync(new URL('./sidebar.css', import.meta.url), 'utf8');
const radii = [...sidebarCss.matchAll(/border-radius:\s*([^;]+);/g)].map((match) => match[1].trim());
assert.ok(radii.length > 0);
assert.ok(radii.every((value) => value.startsWith('var(--radius-')));
assert.match(sidebarCss, /height:\s*var\(--nav-item-height\)/);
assert.match(sidebarCss, /height:\s*var\(--nav-subitem-height\)/);
assert.match(sidebarCss, /height:\s*var\(--nav-profile-height\)/);
assert.match(sidebarCss, /width:\s*var\(--nav-theme-size\)/);
assert.match(sidebarCss, /gap:\s*var\(--nav-gap\)/);

console.log('sidebarShell.check: ok');
