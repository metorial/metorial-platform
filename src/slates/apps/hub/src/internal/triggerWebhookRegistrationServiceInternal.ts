import { Service } from '@lowerdeck/service';
import type {
  Slate,
  SlateTriggerGroup,
  SlateWebhookRegistrationAuthRouting,
  SlateWebhookRegistrationStatus,
  SlateWebhookRegistrationType,
  Tenant
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId, snowflake } from '../id';
import { secretService } from '../services/secret';

let include = {
  slate: true,
  triggerGroup: true,
  authMethods: { include: { authMethod: true as const } },
  oauthCredentials: { include: { oauthCredentials: true as const } }
};

class triggerWebhookRegistrationServiceInternalImpl {
  async createWebhookRegistration(d: {
    tenant: Tenant;
    slate: Slate;
    triggerGroup: SlateTriggerGroup;
    type: SlateWebhookRegistrationType;
    owner?: 'tenant' | 'global';
    status: SlateWebhookRegistrationStatus;
    urlKey: string;
    name: string;
    description?: string;
    metadata?: Record<string, any>;
    webhookRegistrationPayload: any;
    webhookRegistrationIdentifier?: string;
    authMethods?: { oid: bigint }[];
    oauthCredentials?: { oid: bigint }[];
  }) {
    let authRouting: SlateWebhookRegistrationAuthRouting = d.oauthCredentials?.length
      ? 'restricted_credential'
      : d.authMethods?.length
        ? 'restricted_method'
        : 'any';

    let secret = await secretService.createSecret({
      tenant: d.tenant,
      purpose: 'slate_webhook_registration_payload',
      secretData: { payload: d.webhookRegistrationPayload }
    });

    return db.slateWebhookRegistration.create({
      data: {
        ...getId('slateWebhookRegistration'),
        type: d.type,
        owner: d.owner ?? 'tenant',
        status: d.status,
        urlKey: d.urlKey,

        name: d.name,
        description: d.description,
        metadata: d.metadata,

        tenantOid: d.owner === 'global' ? undefined : d.tenant.oid,
        slateOid: d.slate.oid,
        triggerGroupOid: d.triggerGroup.oid,
        secretOid: secret.oid,
        registrationIdentifier: d.webhookRegistrationIdentifier,

        authRouting,
        authMethods: d.authMethods?.length
          ? {
              createMany: {
                data: d.authMethods.map(m => ({
                  oid: snowflake.nextId(),
                  authMethodOid: m.oid
                }))
              }
            }
          : undefined,
        oauthCredentials: d.oauthCredentials?.length
          ? {
              createMany: {
                data: d.oauthCredentials.map(c => ({
                  oid: snowflake.nextId(),
                  oauthCredentialsOid: c.oid
                }))
              }
            }
          : undefined
      },
      include
    });
  }

  async finalizeWebhookRegistration(d: {
    tenant: Tenant;
    registration: { oid: bigint; secretOid: bigint };
    webhookRegistrationPayload: any;
  }) {
    await secretService.DANGEROUSLY_updateSecret({
      secretOid: d.registration.secretOid,
      purpose: 'slate_webhook_registration_payload',
      tenant: d.tenant,
      secretData: { payload: d.webhookRegistrationPayload }
    });

    return db.slateWebhookRegistration.update({
      where: { oid: d.registration.oid },
      data: { status: 'active' },
      include
    });
  }
}

export let triggerWebhookRegistrationServiceInternal = Service.create(
  'triggerWebhookRegistrationServiceInternal',
  () => new triggerWebhookRegistrationServiceInternalImpl()
).build();
