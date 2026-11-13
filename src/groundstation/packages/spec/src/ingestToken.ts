import { v, type ValidationTypeValue } from '@lowerdeck/validation';

export let maxIngestTags = 20;
export let maxIngestTagValueLength = 256;

export let ingestTokenLimitsSchema = v.object({
  itemsPerSecond: v.optional(v.number({ modifiers: [v.positive(), v.integer()] })),
  bytesPerSecond: v.optional(v.number({ modifiers: [v.positive(), v.integer()] })),
  backfillItemsPerSecond: v.optional(v.number({ modifiers: [v.positive(), v.integer()] }))
});

export type IngestTokenLimits = ValidationTypeValue<typeof ingestTokenLimitsSchema>;

export let defaultIngestTokenLimits: IngestTokenLimits = {};

export let ingestTagKeyPattern = /^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)+$/;

export let ingestTagSchema = v.object({
  key: v.string({
    modifiers: [
      v.maxLength(128),
      v.regex(ingestTagKeyPattern, {
        message: 'Tag keys are lowercase and dotted, like "metorial.project".'
      })
    ]
  }),
  value: v.string({ modifiers: [v.minLength(1), v.maxLength(maxIngestTagValueLength)] })
});

export let ingestTagsSchema = v.array(ingestTagSchema, {
  modifiers: [v.maxLength(maxIngestTags)]
});

export type IngestTagInput = ValidationTypeValue<typeof ingestTagSchema>;

export let ingestDeviceModes = ['bound', 'ephemeral'] as const;

export type IngestDeviceMode = (typeof ingestDeviceModes)[number];
