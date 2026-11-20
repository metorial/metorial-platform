import { v, type ValidationTypeValue } from '@lowerdeck/validation';
import { parseWith, spreadSchema } from '../lib/schema';
import { defaultTrafficProfile, modelProfileSchema } from '../load/profile';

let positiveInteger = v.number({ modifiers: [v.integer(), v.minValue(1)] });

let seedShapeSchema = v.object({
  organizations: positiveInteger,
  instancesPerOrganization: positiveInteger,
  developers: positiveInteger,
  days: v.number({ modifiers: [v.integer(), v.minValue(1), v.maxValue(400)] }),
  slicesPerOrganization: positiveInteger,
  eventsPerOrganization: v.number({ modifiers: [v.integer(), v.minValue(0)] }),
  eventDays: v.number({ modifiers: [v.integer(), v.minValue(0), v.maxValue(90)] }),
  weekendShare: v.number(),
  bucketsPerSession: spreadSchema,
  secondModelShare: v.number(),
  requestsPerSlice: spreadSchema,
  eventMix: v.array(
    v.object({
      type: v.enumOf(['model.request', 'tool.call', 'prompt.submitted', 'tool.decision']),
      weight: v.number()
    })
  ),
  models: v.array(modelProfileSchema)
});

export type SeedShape = ValidationTypeValue<typeof seedShapeSchema>;

// Doc 11 §15: 2.3 M slices (one large organization-year, 07 §8.1) and 5 M events. 07 §8.1:
// 200 developers, about 3 slices per session. Everything else is an assumption.
let defaultSeedShape: SeedShape = {
  organizations: 1,
  instancesPerOrganization: 2,
  developers: 200,
  days: 365,
  slicesPerOrganization: 2_300_000,
  eventsPerOrganization: 5_000_000,
  eventDays: 90,
  weekendShare: 0.15,
  bucketsPerSession: { median: 2, p90: 6, min: 1, max: 24 },
  secondModelShare: 0.3,
  requestsPerSlice: { median: 8, p90: 40, min: 1, max: 600 },
  eventMix: [
    { type: 'model.request', weight: 45 },
    { type: 'tool.call', weight: 40 },
    { type: 'prompt.submitted', weight: 10 },
    { type: 'tool.decision', weight: 5 }
  ],
  models: defaultTrafficProfile.models
};

export let smokeSeedShape: Partial<SeedShape> = {
  developers: 20,
  days: 40,
  slicesPerOrganization: 20_000,
  eventsPerOrganization: 40_000,
  eventDays: 30
};

export let resolveSeedShape = (override: Partial<SeedShape> = {}): SeedShape => {
  let shape = parseWith(seedShapeSchema, 'seed shape', { ...defaultSeedShape, ...override });
  if (shape.eventDays > shape.days) throw new Error('eventDays cannot exceed days.');

  return shape;
};
