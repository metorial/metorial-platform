import { auditResources } from '@metorial/audit-schema';
import type { PresenterContext } from '@metorial/presenter';
import type { StashedAuditEvent } from './stash';

let auditPresenterContext: PresenterContext = {
  apiVersion: 'mt_2026_01_01_magnetar',
  accessType: 'event_system'
};

export let presentStashedAuditEvent = async (
  event: StashedAuditEvent
): Promise<StashedAuditEvent> => {
  let resourceDef = (auditResources as any)[event.resource];
  if (!resourceDef?.presenter) return event;

  let actionDef = resourceDef.actions?.[event.action] as
    | true
    | { validationType: unknown }
    | undefined;
  if (actionDef !== true) return event;

  let payload = await resourceDef.presenter
    .present(event.payload)(auditPresenterContext)
    .run();

  let previousAttributes = event.previousAttributes;
  if (previousAttributes !== undefined) {
    previousAttributes = await resourceDef.presenter
      .present(previousAttributes)(auditPresenterContext)
      .run();
  }

  return {
    ...event,
    payload,
    previousAttributes
  };
};
