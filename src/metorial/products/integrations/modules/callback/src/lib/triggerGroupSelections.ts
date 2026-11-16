import { badRequestError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';

let maxGroups = 64;
let maxKeyLength = 128;
let maxKiB = 64;
let maxDepth = 16;
let reservedKeys = new Set(['__proto__', 'constructor', 'prototype']);

let limitsMessage = `Trigger group selections must contain at most ${maxGroups} object selections, use group keys of 1–${maxKeyLength} characters, and contain at most ${maxKiB} KiB of JSON with nesting up to ${maxDepth} levels.`;

export let triggerGroupSelectionsSchema = v.record(v.record(v.any()), {
  description: `Resource selections keyed by trigger group key. Each value must match that group’s selection schema. Limited to ${maxGroups} groups and ${maxKiB} KiB of JSON.`,
  examples: [{ 'spreadsheet-changes': { spreadsheetId: 'spreadsheet-id' } }]
});

let isWithinLimits = (value: unknown, depth = 0): boolean => {
  if (depth > maxDepth) return false;
  if (Array.isArray(value)) return value.every(item => isWithinLimits(item, depth + 1));
  if (!value || typeof value !== 'object') return true;

  return Object.entries(value).every(
    ([key, item]) => !reservedKeys.has(key) && isWithinLimits(item, depth + 1)
  );
};

export let rejectTriggerGroupSelections = (message: string): never => {
  throw new ServiceError(
    badRequestError({ code: 'invalid_trigger_group_selections', message })
  );
};

// undefined leaves the selections unchanged; null or an empty object clears them.
export let parseTriggerGroupSelections = (
  value: unknown
): PrismaJson.TriggerGroupSelections | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (!isWithinLimits(value) || Array.isArray(value) || typeof value !== 'object') {
    return rejectTriggerGroupSelections(limitsMessage);
  }

  let keys = Object.keys(value);
  if (keys.length > maxGroups || keys.some(key => !key.length || key.length > maxKeyLength)) {
    return rejectTriggerGroupSelections(limitsMessage);
  }
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > maxKiB * 1024) {
    return rejectTriggerGroupSelections(limitsMessage);
  }

  let result = triggerGroupSelectionsSchema.validate(value);
  if (!result.success) {
    return rejectTriggerGroupSelections(
      result.errors[0]?.message ?? 'Invalid trigger group selections.'
    );
  }

  return keys.length ? result.value : null;
};
