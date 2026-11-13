import type { NormalizedRecord } from '@metorial/groundstation-spec';
import type { IngestPrincipal } from '../auth/principal';
import type { RecordDocument } from '../store/models';

export let correlationTypes = ['trace', 'request', 'turn', 'generation'] as const;

export type CorrelationType = (typeof correlationTypes)[number];

export type Correlation = { type: CorrelationType; value: string };

export type RecordActor = { userId?: string; deviceId?: string; agentId?: string };

let correlations = (values: [CorrelationType, string | undefined][]): Correlation[] =>
  values.flatMap(([type, value]) => (value ? [{ type, value }] : []));

export let recordCorrelations = (record: NormalizedRecord) => {
  let ctx = record.ctx;

  return correlations([
    ['trace', ctx.trace?.trace_id],
    ['request', ctx.request_id],
    ['turn', ctx.turn_id],
    ['generation', ctx.generation_id]
  ]);
};

export let documentCorrelations = (document: Pick<RecordDocument, 'ctx'>) => {
  let ctx = document.ctx;

  return correlations([
    ['trace', ctx.trace?.traceId],
    ['request', ctx.requestId],
    ['turn', ctx.turnId],
    ['generation', ctx.generationId]
  ]);
};

export let correlationKey = (instanceId: string, correlation: Correlation) =>
  `${instanceId}:${correlation.type}:${correlation.value}`;

export let orphanKey = (instanceId: string, correlation: Correlation) =>
  `orphan:${correlationKey(instanceId, correlation)}`;

// The attribution stage stamps user and device; the credential binding is the same evidence for
// token records, so it covers records that reach this stage unstamped.
export let recordActor = (
  record: NormalizedRecord,
  principal: IngestPrincipal
): RecordActor => {
  let binding = principal.binding;
  let fromToken = record.ingest.credential_kind == 'token';

  return {
    userId: record.attribution?.user_id ?? (fromToken ? binding.userId : undefined),
    deviceId:
      record.attribution?.device_id ??
      (fromToken && binding.deviceMode == 'bound' ? binding.deviceId : undefined),
    agentId: record.attribution?.agent_id ?? (fromToken ? binding.agentId : undefined)
  };
};

// Workspace ids are only stamped on session.context records, so they can't split inferred
// sessions without splitting one session across batches.
export let buildInferKey = (d: { instanceId: string; family: string; actor: RecordActor }) => {
  let actorKey = d.actor.deviceId ?? d.actor.userId;

  return actorKey ? `${d.instanceId}:${d.family}:${actorKey}` : undefined;
};

export let isInferable = (record: NormalizedRecord) =>
  record.kind == 'event' && record.source.role != 'aggregate';
