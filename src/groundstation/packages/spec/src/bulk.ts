import { v, type ValidationTypeValue } from '@lowerdeck/validation';

export let bulkEnvelopeVersion = 'envelope/1';

export let bulkModes = ['live', 'backfill'] as const;

export type BulkMode = (typeof bulkModes)[number];

export let bulkRejectionCodes = [
  'unknown_client',
  'unknown_dialect',
  'unsupported_version',
  'parse_error',
  'too_large',
  'too_old'
] as const;

export type BulkRejectionCode = (typeof bulkRejectionCodes)[number];

export let bulkBatchHeaderSchema = v.object({
  batch_id: v.string(),
  mode: v.enumOf(bulkModes),
  sent_at: v.string(),

  agent: v.object({
    name: v.string(),
    version: v.string(),
    install_id: v.string()
  })
});

export type BulkBatchHeader = ValidationTypeValue<typeof bulkBatchHeaderSchema>;

export let bulkItemSchema = v.object({
  client: v.string(),
  client_version: v.optional(v.string()),
  channel: v.string(),
  dialect: v.string(),

  source: v.object({
    kind: v.string(),
    ref: v.string(),
    seq: v.optional(v.number())
  }),

  observed_at: v.optional(v.string()),

  payload: v.optional(v.record(v.any())),
  payload_line: v.optional(v.string())
});

export type BulkItem = ValidationTypeValue<typeof bulkItemSchema>;

export type BulkRejection = {
  i: number;
  code: BulkRejectionCode;
  detail?: string;
};

export type BulkResponse = {
  batch_id: string;
  accepted: number;
  rejected: number;
  rejections: BulkRejection[];
};

export type BulkDialect = {
  client: string;
  channel: string;
  dialect: string;
  min_version?: string;
  max_version?: string;
};
