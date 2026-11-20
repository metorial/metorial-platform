import { v, type ValidationTypeValue } from '@lowerdeck/validation';
import { parseWith, spreadSchema } from '../lib/schema';

export let modelProfileSchema = v.object({
  id: v.string(),
  weight: v.number(),
  usdPerMillion: v.object({
    input: v.number(),
    output: v.number(),
    cacheRead: v.number(),
    cacheWrite: v.number()
  })
});

export type ModelProfile = ValidationTypeValue<typeof modelProfileSchema>;

let profileSchema = v.object({
  name: v.string(),
  identityDomain: v.string(),
  developers: v.number({ modifiers: [v.integer(), v.minValue(1)] }),
  turnsPerSession: spreadSchema,
  requestsPerTurn: spreadSchema,
  toolCallProbability: v.number(),
  toolCallsWhenUsed: spreadSchema,
  toolDecisionShare: v.number(),
  apiErrorRate: v.number(),
  tokens: v.object({
    inputUncached: spreadSchema,
    cacheRead: spreadSchema,
    cacheWrite: spreadSchema,
    output: spreadSchema
  }),
  requestDurationMs: spreadSchema,
  toolDurationMs: spreadSchema,
  models: v.array(modelProfileSchema),
  tools: v.array(v.object({ value: v.string(), weight: v.number() })),
  clientVersions: v.array(v.string()),
  recordsPerExport: spreadSchema,
  backfill: v.object({
    itemsPerRequest: v.number({ modifiers: [v.integer(), v.minValue(1), v.maxValue(20_000)] }),
    maxAgeDays: v.number()
  })
});

export type TrafficProfile = ValidationTypeValue<typeof profileSchema>;

// Every figure here is an assumption about real Claude Code traffic. Replace them with the
// reconciliation command's measurements.
export let defaultTrafficProfile: TrafficProfile = {
  name: 'claude-code-default',
  identityDomain: 'loadtest.example',
  developers: 200,
  turnsPerSession: { median: 6, p90: 20, min: 1, max: 150 },
  requestsPerTurn: { median: 4, p90: 14, min: 1, max: 80 },
  toolCallProbability: 0.6,
  toolCallsWhenUsed: { median: 1, p90: 3, min: 1, max: 12 },
  toolDecisionShare: 0.3,
  apiErrorRate: 0.01,
  tokens: {
    inputUncached: { median: 40, p90: 2_000, min: 1, max: 200_000 },
    cacheRead: { median: 30_000, p90: 120_000, min: 0, max: 1_000_000 },
    cacheWrite: { median: 1_500, p90: 12_000, min: 0, max: 200_000 },
    output: { median: 350, p90: 2_500, min: 1, max: 64_000 }
  },
  requestDurationMs: { median: 4_500, p90: 18_000, min: 200, max: 300_000 },
  toolDurationMs: { median: 60, p90: 2_500, min: 1, max: 600_000 },
  models: [
    {
      id: 'claude-sonnet-4-5',
      weight: 60,
      usdPerMillion: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 }
    },
    {
      id: 'claude-haiku-4-5',
      weight: 25,
      usdPerMillion: { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 }
    },
    {
      id: 'claude-opus-4-1',
      weight: 15,
      usdPerMillion: { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 }
    }
  ],
  tools: [
    { value: 'Read', weight: 30 },
    { value: 'Edit', weight: 18 },
    { value: 'Bash', weight: 20 },
    { value: 'Grep', weight: 12 },
    { value: 'Glob', weight: 8 },
    { value: 'Write', weight: 5 },
    { value: 'TodoWrite', weight: 4 },
    { value: 'mcp__loadtest__search', weight: 3 }
  ],
  clientVersions: ['2.1.314', '2.1.320', '2.1.326'],
  recordsPerExport: { median: 6, p90: 40, min: 1, max: 512 },
  backfill: { itemsPerRequest: 2_000, maxAgeDays: 7 }
};

let reservedDomain = /(^|\.)(example|test|invalid|localhost)$|(^|\.)example\.(com|net|org)$/i;

let isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value == 'object' && !Array.isArray(value);

let merge = (base: unknown, override: unknown): unknown => {
  if (!isPlainObject(base) || !isPlainObject(override)) return override ?? base;

  let result: Record<string, unknown> = { ...base };
  for (let [key, value] of Object.entries(override)) result[key] = merge(base[key], value);

  return result;
};

export let resolveTrafficProfile = (override: unknown = {}): TrafficProfile => {
  let profile = parseWith(
    profileSchema,
    'traffic profile',
    merge(defaultTrafficProfile, override)
  );

  if (!reservedDomain.test(profile.identityDomain)) {
    throw new Error(
      `identityDomain must be a reserved example domain (RFC 2606), got "${profile.identityDomain}".`
    );
  }

  if (!profile.models.length || !profile.tools.length || !profile.clientVersions.length) {
    throw new Error('The traffic profile needs at least one model, tool and client version.');
  }

  return profile;
};
