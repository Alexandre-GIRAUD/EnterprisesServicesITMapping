const ERROR_DETAIL_LIMIT = 200;

export const CANNOT_SHARE_WITH_YOURSELF = 'You cannot share with yourself.';
export const USER_NOT_FOUND = 'No user with that username.';
export const TABLE_TOO_LARGE = 'That table is too large to share.';

export function formatShareFailure(status: number, detail: string, action = 'Share table'): string {
  if (detail.includes(CANNOT_SHARE_WITH_YOURSELF)) return CANNOT_SHARE_WITH_YOURSELF;
  if (detail.includes(USER_NOT_FOUND)) return USER_NOT_FOUND;
  if (detail.includes(TABLE_TOO_LARGE)) return TABLE_TOO_LARGE;
  const clipped = detail ? `: ${detail.slice(0, ERROR_DETAIL_LIMIT)}` : '';
  return `${action} ${status}${clipped}`;
}
