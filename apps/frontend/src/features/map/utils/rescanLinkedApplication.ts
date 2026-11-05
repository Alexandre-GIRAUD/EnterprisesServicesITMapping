import { suggestConnectionsFromGithub, suggestModulesFromGithub } from '../api/applicationsApi';
import { generateFunctionalDocumentation } from '../api/functionalDocumentationApi';

/** The AI pass behind Scan and Rescan: documentation, modules, then connections and attributes. */
export async function rescanLinkedApplication(applicationId: string): Promise<string[]> {
  const errors: string[] = [];
  try {
    await generateFunctionalDocumentation(applicationId);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Functional documentation failed to start.');
  }
  try {
    await suggestModulesFromGithub(applicationId, { replaceExisting: true });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Module scan failed.');
  }
  try {
    await suggestConnectionsFromGithub(applicationId);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Scan connections and attributes failed.');
  }
  return errors;
}
