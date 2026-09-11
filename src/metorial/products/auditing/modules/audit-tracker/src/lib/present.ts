import { auditResources } from '@metorial/audit-schema';
import { db } from '@metorial/db';
import type { PresenterContext } from '@metorial/presenter';
import { getPreviousAttributes } from './deepDiff';
import type { StashedAuditEvent } from './stash';

let auditPresenterContext: PresenterContext = {
  apiVersion: 'mt_2026_01_01_magnetar',
  accessType: 'event_system'
};

let hydrateOrganizationMemberPayload = async (payload: any) => {
  let member = payload?.organizationMember;
  if (!member || member.user) return payload;

  let user = await db.user.findUnique({
    where: { oid: member.userOid },
    select: { id: true, email: true, name: true, image: true }
  });
  if (!user) return payload;

  return { ...payload, organizationMember: { ...member, user } };
};

let payloadHydrators: Record<string, (payload: any) => Promise<any>> = {
  organization_member: hydrateOrganizationMemberPayload
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
    let hydrate = payloadHydrators[event.resource];
    if (hydrate) {
      payload = await hydrate(payload);
      if (previousPayload !== undefined) previousPayload = await hydrate(previousPayload);
    }

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
