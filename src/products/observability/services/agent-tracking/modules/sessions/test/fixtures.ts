import type { IngestChannel, RecordRole } from '@mtsrc/agent-tracking-spec';
import mongoose from 'mongoose';
import type { SummaryRecord } from '../src/lib/summary';

let counter = 0;

export let usd = (amount: string, basis = 'client_estimate') => ({
  amount: mongoose.Types.Decimal128.fromString(amount),
  unit: 'usd',
  basis
});

export let summaryRecord = (d: {
  type: string;
  at: string;
  id?: string;
  channel?: IngestChannel;
  role?: RecordRole;
  factKey?: string;
  credentialKind?: 'token' | 'source';
  observedAt?: string;
  durationMs?: number;
  ctx?: SummaryRecord['ctx'];
  data?: Record<string, unknown>;
  attribution?: SummaryRecord['attribution'];
  client?: SummaryRecord['client'];
}): SummaryRecord => ({
  _id: d.id ?? `rec_${++counter}`,
  type: d.type,
  occurredAt: new Date(d.at),
  observedAt: new Date(d.observedAt ?? d.at),
  ...(d.durationMs !== undefined ? { durationMs: d.durationMs } : {}),
  source: {
    adapter: 'test',
    dialect: 'test.v1',
    channel: d.channel ?? 'hook',
    role: d.role ?? 'primary',
    ...(d.factKey ? { factKey: d.factKey } : {})
  },
  ingest: {
    credentialKind: d.credentialKind ?? 'token',
    credentialId: 'atit_unit',
    route: 'hook',
    requestId: 'req_unit',
    backfill: false
  },
  client: d.client ?? { family: 'claude-code' },
  ctx: d.ctx ?? {},
  data: d.data ?? {},
  ...(d.attribution ? { attribution: d.attribution } : {})
});
