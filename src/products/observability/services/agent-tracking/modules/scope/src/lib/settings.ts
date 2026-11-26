import type { ClassificationSettings, OrganizationSettings } from '@mtsrc/agent-tracking-spec';

export let mergeSettings = <T extends object>(
  current: T | undefined,
  changes: T | undefined
): T => {
  let merged = { ...current } as Record<string, unknown>;

  for (let [key, value] of Object.entries(changes ?? {})) {
    if (value !== undefined) merged[key] = value;
  }

  return merged as T;
};

// `ai` is merged a level deeper, so a change to one of its fields keeps the others.
export let mergeClassification = (
  current: ClassificationSettings | undefined,
  changes: ClassificationSettings | undefined
): ClassificationSettings | undefined => {
  if (!changes) return undefined;

  return {
    ...mergeSettings(current, changes),
    ...(changes.ai || current?.ai ? { ai: mergeSettings(current?.ai, changes.ai) } : {})
  };
};

export let mergeOrganizationSettings = (
  current: OrganizationSettings | undefined,
  changes: OrganizationSettings | undefined
): OrganizationSettings => ({
  ...mergeSettings(current, changes),
  ...(changes?.desktop ? { desktop: mergeSettings(current?.desktop, changes.desktop) } : {})
});
