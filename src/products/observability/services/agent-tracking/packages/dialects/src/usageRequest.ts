import type { RecordDraft, RecordSource } from '@mtsrc/agent-tracking-records-model';
import type { BulkContext, BulkItemDialect, PayloadCheck } from './types';
import { modelRef, type Cost, type UsageResult } from './values';

let identityPrefixes = { 'model.request': 'request', 'turn.completed': 'turn' } as const;

export type UsageRequest = {
  type?: keyof typeof identityPrefixes;
  sessionId: string;
  identity: (string | number)[];
  requestId?: string;
  factKey?: string | null;
  model: string;
  provider?: string;
  usage: UsageResult;
  cost?: Cost;
  effort?: string;
  purpose?: 'main';
};

type Checked<T> =
  { success: true; value: T } | Extract<ReturnType<PayloadCheck>, { success: false }>;

export let bulkClient = (context: BulkContext, surface?: string): RecordDraft['client'] => ({
  family: context.client,
  ...(context.clientVersion ? { version: context.clientVersion } : {}),
  ...(surface ? { surface } : {})
});

export let usageRequestDraft = (context: BulkContext, d: UsageRequest): RecordDraft => {
  let type = d.type ?? 'model.request';

  return {
    kind: 'event',
    type,
    identity: [identityPrefixes[type], d.sessionId, ...d.identity].join('|'),
    ...(d.factKey !== undefined ? { factKey: d.factKey } : {}),
    occurredAt: null,
    client: bulkClient(context),
    ctx: { sessionId: d.sessionId, ...(d.requestId ? { requestId: d.requestId } : {}) },
    derived: d.usage.derived,
    warnings: d.usage.warnings,
    data: {
      outcome: 'ok',
      ...modelRef(d.model, d.provider),
      ...(d.usage.usage ? { usage: d.usage.usage } : {}),
      ...(d.cost ? { cost: d.cost } : {}),
      ...(d.effort ? { effort: d.effort } : {}),
      ...(d.purpose ? { purpose: d.purpose } : {})
    }
  };
};

export let usageDialect = <T>(d: {
  id: string;
  adapter: string;
  channel: RecordSource['channel'];
  schema: { validate: (payload: Record<string, unknown>) => Checked<T> };
  request: (payload: T) => UsageRequest | null;
}): BulkItemDialect => {
  let source: RecordSource = { adapter: d.adapter, dialect: d.id, channel: d.channel };

  return {
    id: d.id,
    adapter: d.adapter,

    check: payload => d.schema.validate(payload) as ReturnType<PayloadCheck>,

    map: (context, validated) => {
      let request = d.request(validated as T);

      return request ? [{ source, draft: usageRequestDraft(context, request) }] : [];
    }
  };
};
