function readConfiguredValue(name: string): string {
  const configuredEnvironment = (import.meta as { env?: Record<string, string | undefined> }).env;
  return configuredEnvironment?.[name]?.trim() ?? '';
}

/** Public site. Set VITE_FLOWRA_SITE_URL outside the repo. */
export const FLOWRA_SITE_URL = readConfiguredValue('VITE_FLOWRA_SITE_URL');

/** Contact mailbox. Set VITE_FLOWRA_CONTACT_EMAIL outside the repo. */
export const FLOWRA_CONTACT_EMAIL = readConfiguredValue('VITE_FLOWRA_CONTACT_EMAIL');

export function buildContactMailLink(subject: string, message: string): string {
  const mailFields = new URLSearchParams({
    subject: subject.trim() || 'Flowra',
    body: message.trim(),
  });
  return `mailto:${FLOWRA_CONTACT_EMAIL}?${mailFields.toString()}`;
}
