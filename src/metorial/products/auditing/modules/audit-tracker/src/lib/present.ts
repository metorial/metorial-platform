import { auditResources } from '@metorial/audit-schema';
import type { PresenterContext } from '@metorial/presenter';
import { getPreviousAttributes } from './deepDiff';
import type { StashedAuditEvent } from './stash';

let auditPresenterContext: PresenterContext = {
  apiVersion: 'mt_2026_01_01_magnetar',
  accessType: 'event_system'
};

export let presentStashedAuditEvent = async (
  event: StashedAuditEvent
): Promise<
  Omit<StashedAuditEvent, 'previousPayload'> & {
    previousAttributes?: unknown;
  }
> => {
  let resourceDef = (auditResources as any)[event.resource];
  let actionDef = resourceDef?.actions?.[event.action] as
    | true
    | { validationType: unknown }
    | undefined;
  let shouldPresent = Boolean(resourceDef?.presenter && actionDef === true);

  let payload = event.payload;
  let previousPayload = event.previousPayload;
  if (shouldPresent) {
    payload = await resourceDef.presenter.present(payload)(auditPresenterContext).run();

    if (previousPayload !== undefined) {
      previousPayload = await resourceDef.presenter
        .present(previousPayload)(auditPresenterContext)
        .run();
    }
  }

  let previousAttributes =
    previousPayload === undefined
      ? undefined
      : getPreviousAttributes(previousPayload, payload);
  let { previousPayload: _previousPayload, ...storedEvent } = event;

  return {
    ...storedEvent,
    payload,
    previousAttributes
  };
};
