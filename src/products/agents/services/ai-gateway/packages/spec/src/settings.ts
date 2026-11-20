import { v, type ValidationTypeValue } from '@lowerdeck/validation';

export let instanceSettingsSchema = v.object({
  contentLogging: v.optional(
    v.object({
      enabled: v.boolean(),
      retentionDays: v.optional(
        v.number({ modifiers: [v.integer(), v.minValue(1), v.maxValue(90)] })
      )
    })
  ),
  metorialProvider: v.optional(v.object({ enabled: v.boolean() })),
  fallbacks: v.optional(v.object({ enabled: v.boolean() })),
  zeroDataRetention: v.optional(v.object({ required: v.boolean() }))
});

export type InstanceSettings = ValidationTypeValue<typeof instanceSettingsSchema>;

export let defaultContentRetentionDays = 7;

export let resolveInstanceSettings = (settings: InstanceSettings) => ({
  contentLogging: {
    enabled: settings.contentLogging?.enabled ?? false,
    retentionDays: settings.contentLogging?.retentionDays ?? defaultContentRetentionDays
  },
  metorialProviderEnabled: settings.metorialProvider?.enabled ?? true,
  fallbacksEnabled: settings.fallbacks?.enabled ?? true,
  zdrRequired: settings.zeroDataRetention?.required ?? false
});

export type ResolvedInstanceSettings = ReturnType<typeof resolveInstanceSettings>;

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
