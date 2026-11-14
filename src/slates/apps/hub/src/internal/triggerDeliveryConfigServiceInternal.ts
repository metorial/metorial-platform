import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type {
  Slate,
  SlateTriggerGroup,
  SlateWebhookRegistration,
  Tenant
} from '../../prisma/generated/client';
import { db } from '../db';
import { getTriggerDeliveryConfigSpec } from '../lib/triggerDeliveryConfig';
import { secretService } from '../services/secret';
import { globalTenant } from '../services/tenant';

export let TRIGGER_DELIVERY_CONFIG_MISSING = 'trigger_delivery_config_missing';

class triggerDeliveryConfigServiceInternalImpl {
  async selectDeliveryConfig(d: {
    tenant: Tenant;
    slate: Pick<Slate, 'oid'>;
    triggerGroup: Pick<SlateTriggerGroup, 'key' | 'spec'>;
    oauthClientId: string | undefined;
  }) {
    if (!getTriggerDeliveryConfigSpec(d.triggerGroup)) return undefined;

    if (!d.oauthClientId) {
      throw new ServiceError(
        badRequestError({
          code: 'trigger_delivery_oauth_app_required',
          message: 'This trigger needs a connection that uses an OAuth app.'
        })
      );
    }

    // Matched by key so a config outlives spec changes; another tenant's config is never read.
    let configs = await db.slateWebhookRegistration.findMany({
      where: {
        type: 'delivery_config',
        status: 'active',
        slateOid: d.slate.oid,
        oauthClientId: d.oauthClientId,
        triggerGroup: { key: d.triggerGroup.key },
        OR: [{ owner: 'tenant', tenantOid: d.tenant.oid }, { owner: 'global' }]
      },
      orderBy: { oid: 'asc' },
      select: { id: true, owner: true, secretOid: true }
    });

    let config =
      configs.find(candidate => candidate.owner === 'tenant') ??
      configs.find(candidate => candidate.owner === 'global');
    if (!config) {
      throw new ServiceError(
        badRequestError({
          code: TRIGGER_DELIVERY_CONFIG_MISSING,
          message:
            'Delivery is not set up for the OAuth app this connection uses. Finish the delivery setup for this integration, then try again.'
        })
      );
    }

    return {
      bindingId: config.id,
      deliveryConfig: await this.decryptDeliveryConfig({
        registration: config,
        tenant: d.tenant
      })
    };
  }

  // `tenant` owns a tenant config; a global config is always opened as the global tenant.
  async decryptDeliveryConfig(d: {
    registration: Pick<SlateWebhookRegistration, 'id' | 'owner' | 'secretOid'>;
    tenant: Tenant;
  }) {
    let secret = await secretService.DANGEROUSLY_decryptSecret({
      secretOid: d.registration.secretOid,
      purpose: 'slate_webhook_registration_payload',
      tenant: d.registration.owner === 'global' ? globalTenant : d.tenant,
      note: `trigger-delivery-config:${d.registration.id}`
    });

    return secret.payload;
  }
}

export let triggerDeliveryConfigServiceInternal = Service.create(
  'triggerDeliveryConfigServiceInternal',
  () => new triggerDeliveryConfigServiceInternalImpl()
).build();
