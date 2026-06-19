import type {
  ContributorDetail,
  ContributorListItem,
  ContributorWriteRequest,
} from '@/types/api';
import { authenticatedFetch, resolveApiUrl } from '@/config/api';

export async function fetchContributors(): Promise<ContributorListItem[]> {
  const url = resolveApiUrl('/api/contributors');
  const res = await authenticatedFetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Contributors API ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }
  return res.json();
}

export async function fetchContributorById(contributorId: string): Promise<ContributorDetail> {
  const url = resolveApiUrl(`/api/contributors/${encodeURIComponent(contributorId)}`);
  const res = await authenticatedFetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Contributor API ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }
  return res.json();
}

export async function createContributor(
  payload: ContributorWriteRequest
): Promise<ContributorDetail> {
  const url = resolveApiUrl('/api/contributors');
  const res = await authenticatedFetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Create contributor ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }
  return res.json();
}

export async function updateContributor(
  contributorId: string,
  payload: ContributorWriteRequest
): Promise<ContributorDetail> {
  const url = resolveApiUrl(`/api/contributors/${encodeURIComponent(contributorId)}`);
  const res = await authenticatedFetch(url, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Update contributor ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }
  return res.json();
}
