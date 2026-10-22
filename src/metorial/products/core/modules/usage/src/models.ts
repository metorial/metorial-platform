import mongoose from 'mongoose';
import {
  usageDimensionKeys,
  usageMetricKinds,
  type UsageDimensions,
  type UsageMetricKind
} from './lib/types';

export let USAGE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export interface UsageMetric {
  _id: string;
  ts: Date;
  source: 'live' | 'backfill';

  organizationId: string | null;
  instanceId: string;

  kind: UsageMetricKind;
  dims: UsageDimensions;

  count: number;
  errorCount: number;
  durationMsSum: number;
  durationCount: number;
  durationMsMax: number;
}

let UsageDimensionsSchema = new mongoose.Schema<UsageDimensions>(
  Object.fromEntries(usageDimensionKeys.map(key => [key, { type: String, default: null }])),
  { _id: false }
);

export let UsageMetricSchema = new mongoose.Schema<UsageMetric>(
  {
    _id: String,
    ts: Date,
    source: { type: String, enum: ['live', 'backfill'] },

    organizationId: { type: String, default: null },
    instanceId: String,

    kind: { type: String, enum: usageMetricKinds },
    dims: { type: UsageDimensionsSchema, default: {} },

    count: Number,
    errorCount: Number,
    durationMsSum: Number,
    durationCount: Number,
    durationMsMax: Number
  },
  { versionKey: false }
);

UsageMetricSchema.index({ ts: 1 }, { expireAfterSeconds: USAGE_RETENTION_MS / 1000 });
UsageMetricSchema.index({ instanceId: 1, kind: 1, ts: 1 });
UsageMetricSchema.index({ instanceId: 1, kind: 1, 'dims.providerId': 1, ts: 1 });
UsageMetricSchema.index({ instanceId: 1, kind: 1, 'dims.consumerId': 1, ts: 1 });
UsageMetricSchema.index({ instanceId: 1, kind: 1, 'dims.magicMcpServerId': 1, ts: 1 });
UsageMetricSchema.index({ instanceId: 1, kind: 1, 'dims.integrationId': 1, ts: 1 });

export let UsageMetricModel = mongoose.model<UsageMetric>(
  'UsageMetric',
  UsageMetricSchema,
  'usage_metrics'
);

export type UsageBackfillSourceState = {
  done: boolean;
  cursor: string | null;
  updatedAt: Date;
};

export interface UsageBackfillState {
  _id: string;
  cutoff: Date;
  sources: Partial<Record<string, UsageBackfillSourceState>>;
  createdAt: Date;
}

export let UsageBackfillStateSchema = new mongoose.Schema<UsageBackfillState>(
  {
    _id: String,
    cutoff: Date,
    sources: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: Date
  },
  { versionKey: false, minimize: false }
);

export let UsageBackfillStateModel = mongoose.model<UsageBackfillState>(
  'UsageBackfillState',
  UsageBackfillStateSchema,
  'usage_backfill_state'
);
