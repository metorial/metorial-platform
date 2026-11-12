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

// A managed-delivery setup: its payload names the topic and subscription, pushes hit its URL.
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

// Undefined without managed delivery; otherwise the descriptor saved for the connection's OAuth app.
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

  // Matched by key so a config outlives spec changes; another tenant's config is never read.
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
