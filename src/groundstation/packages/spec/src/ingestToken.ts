import { v, type ValidationTypeValue } from '@lowerdeck/validation';

export let ingestTokenLimitsSchema = v.object({
  itemsPerSecond: v.optional(v.number({ modifiers: [v.positive(), v.integer()] })),
  bytesPerSecond: v.optional(v.number({ modifiers: [v.positive(), v.integer()] })),
  backfillItemsPerSecond: v.optional(v.number({ modifiers: [v.positive(), v.integer()] }))
});

export type IngestTokenLimits = ValidationTypeValue<typeof ingestTokenLimitsSchema>;

export let defaultIngestTokenLimits: IngestTokenLimits = {};
