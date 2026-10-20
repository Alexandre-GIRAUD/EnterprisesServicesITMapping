import type { ApplicationResponse } from '@/types/api';
import { isGitHubLinkedApplication } from './githubLinkedApplication';
import { isSandboxId } from './sandboxGraph';

export function thirdPartyApplications(applications: ApplicationResponse[]): ApplicationResponse[] {
  return applications.filter(
    (application) => !isGitHubLinkedApplication(application) && !isSandboxId(application.id)
  );
}
