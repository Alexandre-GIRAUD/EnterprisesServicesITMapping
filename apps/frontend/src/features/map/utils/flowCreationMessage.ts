const APPLICATION_ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export function createdFlowMessage(sourceName: string, targetName: string, isSandbox: boolean): string {
  const between = `The flow between ${sourceName} and ${targetName}`;
  if (isSandbox) return `${between} has been added. It is not saved yet.`;
  return `${between} has been created.`;
}

export function flowCreationErrorMessage(detail: string): string {
  const message = plainServerMessage(detail);
  if (!message) return 'Unable to create the flow.';
  if (/identique existe deja|already exists/i.test(message)) {
    return 'A flow between these applications already exists.';
  }
  if (/differents|must be different/i.test(message)) return 'Choose two different applications.';
  if (/introuvable|not found/i.test(message)) return 'One of the applications could not be found.';
  if (/non autorise|not allowed/i.test(message)) return 'This flow type is not allowed.';
  if (/obligatoires/i.test(message)) return 'Choose both applications and a type.';
  if (/reason is required/i.test(message)) return 'A reason is required.';
  if (/sourceId|targetId|DEPENDS_ON|Create edge API/i.test(message)) return 'Unable to create the flow.';
  return message;
}

function plainServerMessage(detail: string): string {
  const trimmed = detail.trim();
  if (!trimmed) return '';
  const jsonStart = trimmed.indexOf('{');
  const payload = jsonStart >= 0 ? trimmed.slice(jsonStart) : trimmed;
  let message = trimmed;
  try {
    const json = JSON.parse(payload) as { message?: string; detail?: string };
    message = json.message?.trim() || json.detail?.trim() || '';
  } catch {
    if (jsonStart > 0) message = '';
  }
  return message.replace(APPLICATION_ID, '').replace(/\s+/g, ' ').replace(/[:.\s]+$/, '').trim();
}
