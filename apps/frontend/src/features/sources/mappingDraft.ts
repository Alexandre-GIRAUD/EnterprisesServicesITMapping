import type { SourceMappingEntryDto } from '@/types/api';

export type MappingRow = {
  applicationId: string;
  name: string;
  sourceKey: string;
  noMatch: boolean;
  suggested: boolean;
};

/** Saved decisions first, then the suggestion for applications still undecided. */
export function mappingRows(
  applications: { id: string; name: string }[],
  saved: SourceMappingEntryDto[],
  suggestions: Record<string, string>,
): MappingRow[] {
  return applications.map((application) => {
    const entry = saved.find((item) => item.applicationId === application.id);
    if (entry) {
      return {
        applicationId: application.id,
        name: application.name,
        sourceKey: entry.sourceKey ?? '',
        noMatch: entry.noMatch,
        suggested: false,
      };
    }
    const suggestion = suggestions[application.id];
    return {
      applicationId: application.id,
      name: application.name,
      sourceKey: suggestion ?? '',
      noMatch: false,
      suggested: suggestion !== undefined,
    };
  });
}

export function toMappingPayload(rows: MappingRow[]): SourceMappingEntryDto[] {
  return rows
    .filter((row) => row.noMatch || row.sourceKey.trim() !== '')
    .map((row) => ({
      applicationId: row.applicationId,
      sourceKey: row.noMatch ? null : row.sourceKey.trim(),
      noMatch: row.noMatch,
    }));
}
