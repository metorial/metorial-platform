import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import {
  type SlateAction,
  type SlateInvocation,
  type SlateTriggerReceiver,
  type Tenant
} from '../../prisma/generated/client';
import { getTenantForSignal, signal } from '../signal';
import { redactWebhookPayloadMetadata } from '../lib/webhookRequestCapture';

let getCallbackEventOutput = (output: Record<string, any>) => {
  let { url, method, headers, receivedAt, ...semanticOutput } = output;
  return semanticOutput;
};

export let recordCallbackEventLifecycle = async (d: {
  receiver: Pick<SlateTriggerReceiver, 'callbackId' | 'callbackInstanceId'> & {
    tenant: Tenant;
  };
  action: Pick<SlateAction, 'id' | 'key'>;
  event: {
    id: string;
    status: 'pending' | 'processing' | 'retrying' | 'succeeded' | 'failed' | 'skipped';
    type?: string | null;
    sourceId?: string | null;
    input?: Record<string, any> | null;
    output?: Record<string, any> | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    deliveryEventId?: string | null;
    providerInvocation?: Pick<SlateInvocation, 'id'> | null;
  };
}) => {
  if (!d.receiver.callbackId) return null;

  let signalTenant = await getTenantForSignal(d.receiver.tenant);
  let idempotencyKey = await Hash.sha256(
    canonicalize(['callback-event', d.receiver.callbackId, d.event.id])
  );
  let eventType = d.event.type ?? d.action.key;
  let deliveryPayloadJson: string | undefined;

  if (d.event.status === 'succeeded' && d.event.output && !d.event.deliveryEventId) {
    let payload = {
      object: 'callback.event_payload',
      id: d.event.id,
      type: eventType,
      trigger: d.action.key,
      idempotencyKey,
      data: d.event.output
    };

    deliveryPayloadJson = JSON.stringify(payload);
  }

  return await signal.callback.recordEvent({
    tenantId: signalTenant.id,
    callbackId: d.receiver.callbackId,
    eventId: d.event.id,
    status: d.event.status,
    callbackInstanceId: d.receiver.callbackInstanceId,
    sourceId: d.event.sourceId,
    triggerId: d.action.id,
    triggerKey: d.action.key,
    eventType,
    deliveryEventId: d.event.deliveryEventId,
    deliveryPayloadJson,
    inputJson:
      d.event.input === undefined
        ? undefined
        : JSON.stringify(d.event.input ? redactWebhookPayloadMetadata(d.event.input) : null),
    outputJson:
      d.event.output === undefined
        ? undefined
        : JSON.stringify(d.event.output ? getCallbackEventOutput(d.event.output) : null),
    errorCode: d.event.errorCode,
    errorMessage: d.event.errorMessage
  });
};
