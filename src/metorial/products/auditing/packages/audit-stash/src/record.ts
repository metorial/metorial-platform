import type { ValidationType } from '@lowerdeck/validation';
import type { AuditScope } from '@metorial/audit-scope';
import { ID } from '@metorial/db/src/id';
import type {
  ResourceDefinition,
  ResourceSetItemActionNames,
  ResourceSetItemPayload,
  ResourceSetNames
} from './resource';
import { stashAuditEvent, stashAuditEvents, type StashedAuditEvent } from './stash';

type AnyResourceSet = Record<string, ResourceDefinition<string, any, any, any>>;

export interface AuditEventInput<
  Resources extends AnyResourceSet,
  Resource extends ResourceSetNames<Resources> = ResourceSetNames<Resources>,
  Action extends ResourceSetItemActionNames<Resources, Resource> = any
> {
  scope: AuditScope | { auditScope: AuditScope };
  resource: Resource;
  action: Action;
  payload: ResourceSetItemPayload<Resources, Resource, Action>;
  previousPayload?: ResourceSetItemPayload<Resources, Resource, Action>;
  recordedAt?: Date;
}

let validatePayload = (
  validationType: ValidationType<any>,
  payload: unknown,
  label: 'payload' | 'previousPayload'
) => {
  let validated = validationType.validate(payload);
  if (!validated.success) {
    let details = validated.errors
      .map(error => `${error.path?.join('.') || label}: ${error.message}`)
      .join(', ');
    throw new Error(
      label == 'payload'
        ? `Invalid audit event payload: ${details}`
        : `Invalid previous audit event payload: ${details}`
    );
  }

  return validated.value;
};

export let buildStashedAuditEvent = async (
  resources: AnyResourceSet,
  event: AuditEventInput<AnyResourceSet, any, any>
): Promise<StashedAuditEvent> => {
  let resourceDef = resources[event.resource as string];
  if (!resourceDef) throw new Error(`Unknown audit resource: ${String(event.resource)}`);

  let actionDef = (resourceDef.actions as any)[event.action] as
    | true
    | { validationType: ValidationType<any> }
    | undefined;
  if (!actionDef) {
    throw new Error(`Unknown audit action: ${String(event.resource)}.${String(event.action)}`);
  }

  let validationType =
    typeof actionDef === 'object' ? actionDef.validationType : resourceDef.payload;

  let payload = validatePayload(validationType, event.payload, 'payload');
  let previousPayload =
    event.previousPayload === undefined
      ? undefined
      : validatePayload(validationType, event.previousPayload, 'previousPayload');

  let auditScope = 'auditScope' in event.scope ? event.scope.auditScope : event.scope;

  return {
    id: await ID.generateId('auditEvent'),
    organizationOid: auditScope.organizationOid,
    instanceOid: auditScope.instanceOid,
    organizationActorOid: auditScope.organizationActorOid,
    actor: auditScope.actor,
    context: auditScope.context,
    resource: String(event.resource),
    action: String(event.action),
    payload,
    previousPayload,
    recordedAt: event.recordedAt ?? new Date()
  };
};

export let createAuditRecorder = <Resources extends AnyResourceSet>(resources: Resources) => ({
  recordEvent: async <
    Resource extends ResourceSetNames<Resources>,
    Action extends ResourceSetItemActionNames<Resources, Resource>
  >(
    scope: AuditScope | { auditScope: AuditScope },
    resource: Resource,
    action: Action,
    event: {
      payload: ResourceSetItemPayload<Resources, Resource, Action>;
      previousPayload?: ResourceSetItemPayload<Resources, Resource, Action>;
      recordedAt?: Date;
    }
  ) => {
    await stashAuditEvent(
      await buildStashedAuditEvent(resources, { scope, resource, action, ...event } as any)
    );
  },

  recordEvents: async (events: AuditEventInput<Resources, any, any>[]) => {
    if (events.length == 0) return;

    let stashedEvents: StashedAuditEvent[] = [];
    for (let event of events) {
      stashedEvents.push(await buildStashedAuditEvent(resources, event as any));
    }

    await stashAuditEvents(stashedEvents);
  }
});
