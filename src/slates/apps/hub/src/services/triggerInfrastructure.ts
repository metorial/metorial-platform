import { badRequestError, ServiceError } from '@lowerdeck/error';
import {
  authenticateTriggerDelivery,
  requestsTriggerInfrastructure,
  selectTriggerDeliveryConfig
} from '@slates/managed-trigger-delivery';
import type { SlatesTriggerGroupInfrastructure } from '@slates/proto';
import type {
  Slate,
  SlateTriggerGroup,
  SlateWebhookRegistration,
  Tenant
} from '../../prisma/generated/client';
import { db } from '../db';
import { secretService } from './secret';
import { globalTenant } from './tenant';

export { requestsTriggerInfrastructure };

export let TRIGGER_DELIVERY_CONFIG_MISSING = 'trigger_delivery_config_missing';

type GroupInvocation = { spec: { invocation: unknown } };

// The registration a person set up for a trigger group with managed delivery. Its payload
// describes the topic and push subscription, and its receive URL is where pushes arrive.
export let isTriggerDeliveryConfig = (
  registration: Pick<SlateWebhookRegistration, 'type'> & { triggerGroup: GroupInvocation }
) =>
  registration.type === 'manual' &&
  requestsTriggerInfrastructure(registration.triggerGroup.spec.invocation);

let decryptConfig = async (
  registration: Pick<SlateWebhookRegistration, 'id' | 'owner' | 'secretOid'>,
  tenant: Tenant
) => {
  let secret = await secretService.DANGEROUSLY_decryptSecret({
    secretOid: registration.secretOid,
    purpose: 'slate_webhook_registration_payload',
    tenant: registration.owner === 'global' ? globalTenant : tenant,
    note: `trigger-delivery-config:${registration.id}`
  });
  return secret.payload;
};

// Undefined when the trigger group needs no managed delivery. Nothing is provisioned here:
// the descriptor is the one saved with the delivery config for the connection's OAuth app.
export let getTriggerInfrastructure = async (d: {
  tenant: Tenant;
  slate: Pick<Slate, 'oid'>;
  triggerGroup: Pick<SlateTriggerGroup, 'key'> & GroupInvocation;
  oauthClientId?: string;
}): Promise<
  { bindingId: string; infrastructure: SlatesTriggerGroupInfrastructure } | undefined
> => {
  let invocation = d.triggerGroup.spec.invocation;
  if (!requestsTriggerInfrastructure(invocation)) return undefined;

  // Matched by key: a changed spec gives the trigger group a new row, and a config must
  // outlive that. Deliveries are routed by config alone, so another tenant's is never read.
  let registrations = await db.slateWebhookRegistration.findMany({
    where: {
      type: 'manual',
      status: 'active',
      slateOid: d.slate.oid,
      triggerGroup: { key: d.triggerGroup.key },
      OR: [{ owner: 'tenant', tenantOid: d.tenant.oid }, { owner: 'global' }]
    },
    orderBy: { oid: 'asc' },
    select: { id: true, owner: true, secretOid: true }
  });

  let configs: { id: string; payload: unknown }[] = [];
  for (let owner of ['tenant', 'global'] as const) {
    for (let registration of registrations.filter(r => r.owner === owner)) {
      configs.push({
        id: registration.id,
        payload: await decryptConfig(registration, d.tenant)
      });
    }
  }

  let delivery = selectTriggerDeliveryConfig({
    invocation,
    oauthClientId: d.oauthClientId,
    configs
  });
  if (!delivery) {
    throw new ServiceError(
      badRequestError({
        code: TRIGGER_DELIVERY_CONFIG_MISSING,
        message:
          'Delivery is not set up for the Google OAuth app this connection uses. Finish the delivery setup for this integration, then try again.'
      })
    );
  }

  return delivery;
};

export let authenticateTriggerDeliveryConfigPush = async (d: {
  registration: Pick<SlateWebhookRegistration, 'id' | 'owner' | 'secretOid' | 'tenantOid'> & {
    triggerGroup: GroupInvocation;
  };
  request: Request;
}) => {
  let tenant =
    d.registration.owner === 'global'
      ? globalTenant
      : await db.tenant.findUniqueOrThrow({ where: { oid: d.registration.tenantOid! } });

  return authenticateTriggerDelivery({
    invocation: d.registration.triggerGroup.spec.invocation,
    payload: await decryptConfig(d.registration, tenant),
    request: d.request
  });
};
