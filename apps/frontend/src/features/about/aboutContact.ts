function readConfiguredValue(name: string): string {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  return env?.[name]?.trim() ?? '';
}

/** Public site. Set VITE_FLOWRA_SITE_URL outside the repo. */
export const FLOWRA_SITE_URL = readConfiguredValue('VITE_FLOWRA_SITE_URL');

/** Contact mailbox. Set VITE_FLOWRA_CONTACT_EMAIL outside the repo. */
export const FLOWRA_CONTACT_EMAIL = readConfiguredValue('VITE_FLOWRA_CONTACT_EMAIL');

export function buildContactMailHref(subject: string, message: string): string {
  const params = new URLSearchParams({
    subject: subject.trim() || 'Flowra',
    body: message.trim(),
  });
  return `mailto:${FLOWRA_CONTACT_EMAIL}?${params.toString()}`;
}
