import type { DataModelDetection, DataModelFieldDto } from '@/types/api';

export type SourceChoice = 'code' | 'manual' | string;
export type SourceOption = { value: SourceChoice; label: string };

export function fieldSourceChoice(field: Pick<DataModelFieldDto, 'detection' | 'sourceId'>): SourceChoice {
  if (field.sourceId) {
    return field.sourceId;
  }
  return field.detection === 'MANUAL' ? 'manual' : 'code';
}

/** An external source is stored as manual detection, so the AI scan never lists the field. */
export function sourceChoicePatch(choice: SourceChoice): {
  detection: DataModelDetection;
  sourceId: string | undefined;
} {
  if (choice === 'code') {
    return { detection: 'AUTOMATIC_DETECTION', sourceId: undefined };
  }
  return { detection: 'MANUAL', sourceId: choice === 'manual' ? undefined : choice };
}

/** Attributes this source fills. A source being created has no id, so nothing is listed. */
export function attributesFedBySource<T extends { sourceId?: string }>(
  fields: T[],
  sourceId: string | null,
): T[] {
  if (!sourceId) {
    return [];
  }
  return fields.filter((field) => field.sourceId === sourceId);
}

/** Only application (NODE) attributes can be fed by an added source. */
export function sourceChoiceOptions(
  sources: { id: string; name: string }[],
  allowExternal: boolean,
): SourceOption[] {
  const options: SourceOption[] = [
    { value: 'code', label: 'Code' },
    { value: 'manual', label: 'Manual' },
  ];
  if (allowExternal) {
    sources.forEach((source) => options.push({ value: source.id, label: source.name }));
  }
  return options;
}
