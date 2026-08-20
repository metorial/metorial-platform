import type { SpecificationTrigger } from '@metorial-subspace/provider-utils/src/types/specification';
import { projectSlatesSpecificationTriggerWebhookHttp } from '@metorial-subspace/provider-utils/src/types/webhookVerification';

export type SlatesSpecificationTrigger = {
  id: string;
  identifier?: string | null;
  key: string;
  name: string;
  description?: string | null;
  inputSchema: Record<string, any>;
  outputSchema?: Record<string, any> | null;
  capabilities?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  scopes?: SpecificationTrigger['scopes'];
  invocation:
    | {
        type: 'polling';
        intervalSeconds: number;
      }
    | {
        type: 'webhook';
        autoRegistration: boolean;
        autoUnregistration: boolean;
        http?: unknown;
      }
    | null
    | undefined;
};

let getDeclaredEventTypes = (trigger: SlatesSpecificationTrigger) => {
  let eventTypes = trigger.metadata?.eventTypes;

  if (
    !Array.isArray(eventTypes) ||
    eventTypes.some(
      eventType =>
        typeof eventType !== 'string' || !eventType || eventType !== eventType.trim()
    ) ||
    new Set(eventTypes).size !== eventTypes.length
  ) {
    throw new TypeError(`Trigger ${trigger.key} publishes invalid eventTypes metadata`);
  }

  return [...eventTypes];
};

export let mapSlatesSpecificationTrigger = (
  trigger: SlatesSpecificationTrigger & {
    invocation: NonNullable<SlatesSpecificationTrigger['invocation']>;
  }
): SpecificationTrigger => ({
  specId: trigger.id,
  specUniqueIdentifier: trigger.identifier ?? undefined,
  callableId: trigger.key,
  key: trigger.key,
  name: trigger.name,
  description: trigger.description ?? undefined,
  inputJsonSchema: trigger.inputSchema,
  outputJsonSchema: trigger.outputSchema ?? undefined,
  eventTypes: getDeclaredEventTypes(trigger),
  invocation:
    trigger.invocation.type === 'polling'
      ? {
          type: 'polling',
          intervalSeconds: trigger.invocation.intervalSeconds
        }
      : {
          type: 'webhook',
          autoRegistration: trigger.invocation.autoRegistration,
          autoUnregistration: trigger.invocation.autoUnregistration,
          http: projectSlatesSpecificationTriggerWebhookHttp(trigger.invocation.http)
        },
  capabilities: trigger.capabilities ?? {},
  metadata: trigger.metadata ?? {},
  scopes: trigger.scopes ?? null
});

/** One authoritative mapping result is reused for both provider specification paths. */
export let mapSlatesSpecificationTriggers = (
  triggers: SlatesSpecificationTrigger[]
): SpecificationTrigger[] =>
  triggers
    .filter(
      (
        trigger
      ): trigger is SlatesSpecificationTrigger & {
        invocation: NonNullable<SlatesSpecificationTrigger['invocation']>;
      } => trigger.invocation != null
    )
    .map(mapSlatesSpecificationTrigger);
