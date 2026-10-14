export const FLOWRA_SITE_URL = 'http://92.222.78.26:3000/login';
export const FLOWRA_CONTACT_EMAIL = 'flowra.cartography@gmail.com';

export function contactMailHref(subject: string, message: string): string {
  const params = new URLSearchParams({
    subject: subject.trim() || 'Flowra',
    body: message.trim(),
  });
  return `mailto:${FLOWRA_CONTACT_EMAIL}?${params.toString()}`;
}
