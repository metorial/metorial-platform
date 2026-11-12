import { badRequestError, conflictError, notFoundError, ServiceError } from '@lowerdeck/error';
import { generateCustomId } from '@lowerdeck/id';
import { createLock } from '@lowerdeck/lock';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  Slate,
  SlateTriggerGroup,
  SlateWebhookRegistration,
  SlateWebhookRegistrationAuthRouting,
  SlateWebhookRegistrationOwner,
  SlateWebhookRegistrationStatus,
  SlateWebhookRegistrationType,
  Tenant
} from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import { triggerWebhookRegistrationServiceInternal } from '../internal';
import { getActiveSlateVersion } from '../lib/slateVersion';
import { getTriggerDeliveryConfigSpec } from '../lib/triggerDeliveryConfig';
import { validateJsonSchema } from '../lib/validateJsonSchema';
import { getWebhookUrl } from '../lib/webhookUrl';
import { triggerWebhookRegistrationRematchQueue } from '../queues/trigger/webhookRegistrationRematch';
import { secretService } from './secret';
import { slateService } from './slate';
import { slateInvocationService } from './slateInvocation';
import { globalTenant } from './tenant';

let include = {
  slate: true,
  triggerGroup: true,
  authMethods: { include: { authMethod: true as const } },
  oauthCredentials: { include: { oauthCredentials: true as const } }
};

let adminInclude = {
  slate: true,
  triggerGroup: true,
  tenant: true,
  triggerWebhookTarget: true
};

let deliveryConfigLock = createLock({
  name: 'shub/whk/delivery-config/lock',
  redisUrl: env.service.REDIS_URL
});

let deliveryConfigLockOptions = { acquisitionTimeoutMs: 30_000 };

let getRegion = () => {
  let region =
    env.service.METORIAL_REGION ??
    (env.service.METORIAL_ENV !== 'production' ? 'dev' : undefined);
  if (!region)
    throw new Error('METORIAL_REGION is required to generate webhook registrations');
  if (!/^[a-z0-9-]+$/.test(region)) throw new Error(`Invalid METORIAL_REGION: ${region}`);
  return region;
};

export let generateWebhookRegistrationUrlKey = (
  owner: SlateWebhookRegistrationOwner = 'tenant'
) => `${generateCustomId(owner === 'global' ? 'whk_global_' : 'whk_', 35)}_${getRegion()}`;

type ManualWebhookRegistrationSpec = {
  userConfigSchema: Record<string, any>;
  fullConfigSchema: Record<string, any>;
};

// What a person fills in: a manual webhook, or the delivery config of an automatic group.
let getManualWebhookRegistrationSpec = (
  triggerGroup: SlateTriggerGroup
): ManualWebhookRegistrationSpec | null => {
  let invocation = triggerGroup.spec.invocation;
  if (invocation.type !== 'webhook') return null;
  if (invocation.registration.mode === 'manual') return invocation.registration;

  return getTriggerDeliveryConfigSpec(triggerGroup);
};

type DeletableWebhookRegistration = Pick<
  SlateWebhookRegistration,
  'oid' | 'id' | 'type' | 'tenantOid'
>;

class slateWebhookRegistrationServiceImpl {
  async getWebhookRegistrationById(d: {
    tenant: Tenant;
    id: string;
    types?: SlateWebhookRegistrationType[];
  }) {
    let registration = await db.slateWebhookRegistration.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        owner: 'tenant',
        id: d.id,
        status: { not: 'deleted' },
        type: d.types ? { in: d.types } : undefined
      },
      include
    });
    if (!registration) throw new ServiceError(notFoundError('webhook_registration'));
    return registration;
  }

  async getWebhookRegistrationByUrlKey(d: { urlKey: string }) {
    let registration = await db.slateWebhookRegistration.findUnique({
      where: { urlKey: d.urlKey },
      include
    });
    if (!registration) throw new ServiceError(notFoundError('webhook_registration'));
    return registration;
  }

  async listWebhookRegistrations(d: {
    tenant: Tenant;
    types?: SlateWebhookRegistrationType[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateWebhookRegistration.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              owner: 'tenant',
              status: { not: 'deleted' },
              type: d.types ? { in: d.types } : undefined
            },
            include
          })
      )
    );
  }

  async getManyWebhookRegistrationsByIds(d: {
    tenant: Tenant;
    ids: string[];
    types?: SlateWebhookRegistrationType[];
  }) {
    return db.slateWebhookRegistration.findMany({
      where: {
        tenantOid: d.tenant.oid,
        owner: 'tenant',
        id: { in: d.ids },
        status: { not: 'deleted' },
        type: d.types ? { in: d.types } : undefined
      },
      include
    });
  }

  async getDeliveryConfigsServingOAuthCredentials(d: {
    tenant: Tenant;
    oauthCredentialsIds: string[];
  }) {
    let credentials = await db.slateOAuthCredentials.findMany({
      where: { tenantOid: d.tenant.oid, id: { in: d.oauthCredentialsIds } },
      select: { slateOid: true, clientId: true }
    });
    if (!credentials.length) return [];

    return db.slateWebhookRegistration.findMany({
      where: {
        tenantOid: d.tenant.oid,
        owner: 'tenant',
        type: 'delivery_config',
        status: { in: ['active', 'awaiting_setup'] },
        OR: credentials.map(c => ({ slateOid: c.slateOid, oauthClientId: c.clientId }))
      },
      include
    });
  }

  async createManualWebhookSetup(d: {
    tenant: Tenant;
    input: {
      slateId: string;
      name: string;
      description?: string;
      metadata?: Record<string, any>;
      authRouting?: SlateWebhookRegistrationAuthRouting;
      authMethodIds?: string[];
      slateOAuthCredentialsIds?: string[];
      deliveryConfigOAuthCredentialsId?: string;
    };
  }) {
    let { slate, triggerGroup } = await this.resolveManualWebhookTriggerGroup({
      slateId: d.input.slateId
    });
    let oauthClientId = await this.resolveDeliveryConfigOAuthClientId({
      tenant: d.tenant,
      slate,
      triggerGroup,
      oauthCredentialsId: d.input.deliveryConfigOAuthCredentialsId
    });

    let authRouting = d.input.authRouting ?? 'any';
    let authMethods = d.input.authMethodIds?.length
      ? await this.resolveAuthMethods({ slate, authMethodIds: d.input.authMethodIds })
      : [];
    let oauthCredentials = d.input.slateOAuthCredentialsIds?.length
      ? await this.resolveOAuthCredentials({
          tenant: d.tenant,
          slate,
          credentialIds: d.input.slateOAuthCredentialsIds
        })
      : [];

    this.assertAuthRouting({
      authRouting,
      methodCount: authMethods.length,
      credentialCount: oauthCredentials.length,
      allowCredentials: true
    });

    return this.usingDeliveryConfigSlot(
      { owner: 'tenant', tenant: d.tenant, slate, triggerGroup, oauthClientId },
      async () => {
        let urlKey = generateWebhookRegistrationUrlKey('tenant');

        let { partialWebhookRegistrationPayload, webhookSetupDocument } =
          await this.startWebhookSetup({
            tenant: d.tenant,
            slate,
            triggerGroup,
            urlKey
          });

        let registrationSpec = getManualWebhookRegistrationSpec(triggerGroup);

        let registration =
          await triggerWebhookRegistrationServiceInternal.createWebhookRegistration({
            tenant: d.tenant,
            slate,
            triggerGroup,
            type: oauthClientId ? 'delivery_config' : 'manual',
            owner: 'tenant',
            status: 'awaiting_setup',
            urlKey,
            oauthClientId,

            name: d.input.name,
            description: d.input.description,
            metadata: d.input.metadata,

            webhookRegistrationPayload: partialWebhookRegistrationPayload,
            authRouting,
            authMethods,
            oauthCredentials
          });

        return {
          registration,
          webhookSetupDocument,
          userConfigSchema: registrationSpec?.userConfigSchema ?? null
        };
      }
    );
  }

  async finishManualWebhookSetup(d: {
    tenant: Tenant;
    registration: SlateWebhookRegistration & {
      slate: Slate;
      triggerGroup: SlateTriggerGroup;
    };
    input: { userConfig: Record<string, any> };
  }) {
    if (d.registration.status !== 'awaiting_setup') {
      throw new ServiceError(
        badRequestError({ message: 'This webhook registration is not awaiting setup.' })
      );
    }

    let partial = await secretService.DANGEROUSLY_decryptSecret({
      secretOid: d.registration.secretOid,
      purpose: 'slate_webhook_registration_payload',
      tenant: d.tenant,
      note: `webhook-manual-finish:${d.registration.urlKey}`
    });

    let webhookRegistrationPayload = await this.callManualFinishRpc({
      tenant: d.tenant,
      slate: d.registration.slate,
      triggerGroup: d.registration.triggerGroup,
      urlKey: d.registration.urlKey,
      partialWebhookRegistrationPayload: partial.payload,
      userConfig: d.input.userConfig
    });

    let registration =
      await triggerWebhookRegistrationServiceInternal.finalizeWebhookRegistration({
        tenant: d.tenant,
        registration: d.registration,
        webhookRegistrationPayload
      });

    // When a TriggerRegistrationInstance was created before a suitable webhook existed, it will have
    // errored - we now patch it up by re-matching it to the newly created webhook registration.
    // For a delivery config, registrations that failed for lack of one are tried again.
    await triggerWebhookRegistrationRematchQueue.add({
      webhookRegistrationId: registration.id
    });

    return registration;
  }

  async createGlobalWebhookRegistration(d: {
    input: {
      slateId: string;
      name: string;
      description?: string;
      metadata?: Record<string, any>;
      userConfig: Record<string, any>;
      oauthClientId?: string;
      authRouting?: SlateWebhookRegistrationAuthRouting;
      authMethodIds?: string[];
    };
  }) {
    let { slate, triggerGroup } = await this.resolveManualWebhookTriggerGroup({
      slateId: d.input.slateId
    });
    let oauthClientId = this.resolveGlobalDeliveryConfigOAuthClientId({
      triggerGroup,
      oauthClientId: d.input.oauthClientId
    });

    let authRouting = d.input.authRouting ?? 'any';
    let authMethods = d.input.authMethodIds?.length
      ? await this.resolveAuthMethods({ slate, authMethodIds: d.input.authMethodIds })
      : [];

    this.assertAuthRouting({
      authRouting,
      methodCount: authMethods.length,
      credentialCount: 0,
      allowCredentials: false
    });

    let registration = await this.usingDeliveryConfigSlot(
      { owner: 'global', tenant: globalTenant, slate, triggerGroup, oauthClientId },
      async () => {
        let urlKey = generateWebhookRegistrationUrlKey('global');

        let { partialWebhookRegistrationPayload } = await this.startWebhookSetup({
          tenant: globalTenant,
          slate,
          triggerGroup,
          urlKey
        });

        let webhookRegistrationPayload = await this.callManualFinishRpc({
          tenant: globalTenant,
          slate,
          triggerGroup,
          urlKey,
          partialWebhookRegistrationPayload,
          userConfig: d.input.userConfig
        });

        return triggerWebhookRegistrationServiceInternal.createWebhookRegistration({
          tenant: globalTenant,
          slate,
          triggerGroup,
          type: oauthClientId ? 'delivery_config' : 'manual',
          owner: 'global',
          status: 'active',
          urlKey,
          oauthClientId,

          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,

          webhookRegistrationPayload,
          authRouting,
          authMethods
        });
      }
    );

    // A global registration is a candidate for every tenant's instances, so instances that
    // previously errored with no matching webhook registration may now be able to match it.
    await triggerWebhookRegistrationRematchQueue.add({
      webhookRegistrationId: registration.id
    });

    return registration;
  }

  async getGlobalWebhookRegistrationById(d: { id: string }) {
    let registration = await db.slateWebhookRegistration.findFirst({
      where: { id: d.id, owner: 'global', status: { not: 'deleted' } },
      include
    });
    if (!registration) throw new ServiceError(notFoundError('webhook_registration'));
    return registration;
  }

  async listGlobalWebhookRegistrations(d: { slateIds?: string[] }) {
    let slates = d.slateIds
      ? await db.slate.findMany({ where: { id: { in: d.slateIds } } })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateWebhookRegistration.findMany({
            ...opts,
            where: {
              owner: 'global',
              status: { not: 'deleted' },
              slateOid: slates ? { in: slates.map(s => s.oid) } : undefined
            },
            include
          })
      )
    );
  }

  async updateGlobalWebhookRegistration(d: {
    registration: { oid: bigint };
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    return db.slateWebhookRegistration.update({
      where: { oid: d.registration.oid },
      data: {
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata
      },
      include
    });
  }

  async deleteGlobalWebhookRegistration(d: { registration: DeletableWebhookRegistration }) {
    await db.slateWebhookRegistration.update({
      where: { oid: d.registration.oid },
      data: { status: 'deleted' }
    });
    await this.releaseDeliveryConfig(d.registration);
  }

  async updateWebhookRegistration(d: {
    tenant: Tenant;
    registration: { oid: bigint; tenantOid: bigint | null };
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    if (d.registration.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('webhook_registration'));
    }

    return db.slateWebhookRegistration.update({
      where: { oid: d.registration.oid },
      data: {
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata
      },
      include
    });
  }

  async deleteWebhookRegistration(d: {
    tenant: Tenant;
    registration: DeletableWebhookRegistration;
  }) {
    if (d.registration.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('webhook_registration'));
    }

    await db.slateWebhookRegistration.update({
      where: { oid: d.registration.oid },
      data: { status: 'deleted' }
    });
    await this.releaseDeliveryConfig(d.registration);
  }

  // Registrations on a removed config would look healthy yet receive nothing, so re-register
  // them; the second pass catches ones mid-registration.
  private async releaseDeliveryConfig(registration: DeletableWebhookRegistration) {
    if (registration.type !== 'delivery_config') return;
    let job = { webhookRegistrationId: registration.id };
    await triggerWebhookRegistrationRematchQueue.add(job);
    await triggerWebhookRegistrationRematchQueue.add(job, { delay: 5 * 60 * 1000 });
  }

  async getWebhookRegistrationForAdmin(d: { id: string }) {
    let registration = await db.slateWebhookRegistration.findFirst({
      where: { id: d.id, status: { not: 'deleted' } },
      include: adminInclude
    });
    if (!registration) throw new ServiceError(notFoundError('webhook_registration'));
    return registration;
  }

  async listWebhookRegistrationsForAdmin(d: {
    search?: string;
    types?: SlateWebhookRegistrationType[];
    owners?: SlateWebhookRegistrationOwner[];
    statuses?: SlateWebhookRegistrationStatus[];
  }) {
    let search = d.search?.trim();
    let contains = search ? { contains: search, mode: 'insensitive' as const } : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateWebhookRegistration.findMany({
            ...opts,
            where: {
              status: d.statuses?.length ? { in: d.statuses } : { not: 'deleted' },
              type: d.types?.length ? { in: d.types } : undefined,
              owner: d.owners?.length ? { in: d.owners } : undefined,
              ...(contains
                ? {
                    OR: [
                      { name: contains },
                      { description: contains },
                      { urlKey: contains },
                      { id: contains },
                      {
                        slate: {
                          OR: [
                            { name: contains },
                            { identifier: contains },
                            { slateFullIdentifierOnRegistry: contains }
                          ]
                        }
                      },
                      {
                        tenant: {
                          OR: [{ name: contains }, { identifier: contains }, { id: contains }]
                        }
                      },
                      {
                        triggerGroup: {
                          OR: [{ name: contains }, { key: contains }]
                        }
                      },
                      {
                        triggerWebhookTarget: {
                          OR: [{ name: contains }, { targetIdentifier: contains }]
                        }
                      }
                    ]
                  }
                : {})
            },
            orderBy: [{ createdAt: 'desc' }, { oid: 'desc' }],
            include: adminInclude
          })
      )
    );
  }

  private async resolveAuthMethods(d: { slate: Slate; authMethodIds: string[] }) {
    let methods = await slateService.listCurrentAuthMethods({ slate: d.slate });

    let resolved = methods.filter(m => d.authMethodIds.includes(m.id));
    let missing = d.authMethodIds.filter(id => !resolved.some(m => m.id === id));
    if (missing.length) {
      throw new ServiceError(
        badRequestError({
          code: 'invalid_auth_method_id',
          message: `Unknown auth method id(s): ${missing.join(', ')}`
        })
      );
    }

    return resolved;
  }

  private async resolveOAuthCredentials(d: {
    tenant: Tenant;
    slate: Slate;
    credentialIds: string[];
  }) {
    let credentials = await db.slateOAuthCredentials.findMany({
      where: { tenantOid: d.tenant.oid, slateOid: d.slate.oid, id: { in: d.credentialIds } }
    });

    let missing = d.credentialIds.filter(id => !credentials.some(c => c.id === id));
    if (missing.length) {
      throw new ServiceError(
        badRequestError({
          code: 'invalid_oauth_credentials_id',
          message: `Unknown or inaccessible OAuth credentials id(s): ${missing.join(', ')}`
        })
      );
    }

    return credentials;
  }

  private assertAuthRouting(d: {
    authRouting: SlateWebhookRegistrationAuthRouting;
    methodCount: number;
    credentialCount: number;
    allowCredentials: boolean;
  }) {
    if (d.authRouting === 'restricted_method' && d.methodCount === 0) {
      throw new ServiceError(
        badRequestError({
          message: 'authRouting is "restricted_method" but no authMethodIds were provided.'
        })
      );
    }

    if (d.authRouting === 'restricted_credential') {
      if (!d.allowCredentials) {
        throw new ServiceError(
          badRequestError({
            message:
              'authRouting "restricted_credential" is not supported for global registrations.'
          })
        );
      }
      if (d.credentialCount === 0) {
        throw new ServiceError(
          badRequestError({
            message:
              'authRouting is "restricted_credential" but no slateOAuthCredentialsIds were provided.'
          })
        );
      }
    }
  }

  private async resolveDeliveryConfigOAuthClientId(d: {
    tenant: Tenant;
    slate: Slate;
    triggerGroup: SlateTriggerGroup;
    oauthCredentialsId: string | undefined;
  }) {
    if (!getTriggerDeliveryConfigSpec(d.triggerGroup)) {
      if (d.oauthCredentialsId) {
        throw new ServiceError(
          badRequestError({
            code: 'delivery_config_oauth_credentials_not_applicable',
            message:
              'This webhook setup is not a delivery setup, so it takes no OAuth credentials.'
          })
        );
      }
      return null;
    }

    if (!d.oauthCredentialsId) {
      throw new ServiceError(
        badRequestError({
          code: 'delivery_config_oauth_credentials_required',
          message: 'Select the OAuth credentials this delivery setup is for.'
        })
      );
    }

    let [credentials] = await this.resolveOAuthCredentials({
      tenant: d.tenant,
      slate: d.slate,
      credentialIds: [d.oauthCredentialsId]
    });
    return credentials!.clientId;
  }

  private resolveGlobalDeliveryConfigOAuthClientId(d: {
    triggerGroup: SlateTriggerGroup;
    oauthClientId: string | undefined;
  }) {
    let oauthClientId = d.oauthClientId?.trim() || null;

    if (!getTriggerDeliveryConfigSpec(d.triggerGroup)) {
      if (oauthClientId) {
        throw new ServiceError(
          badRequestError({
            code: 'delivery_config_oauth_client_id_not_applicable',
            message: 'This webhook is not a delivery setup, so it takes no OAuth client ID.'
          })
        );
      }
      return null;
    }

    if (!oauthClientId) {
      throw new ServiceError(
        badRequestError({
          code: 'delivery_config_oauth_client_id_required',
          message: 'Enter the OAuth client ID this delivery setup is for.'
        })
      );
    }

    return oauthClientId;
  }

  // Live configs are matched by trigger group key, which no database constraint can cover.
  private async usingDeliveryConfigSlot<T>(
    d: {
      owner: SlateWebhookRegistrationOwner;
      tenant: Tenant;
      slate: Slate;
      triggerGroup: SlateTriggerGroup;
      oauthClientId: string | null;
    },
    fn: () => Promise<T>
  ) {
    let oauthClientId = d.oauthClientId;
    if (!oauthClientId) return fn();

    let tenantOid = d.owner === 'tenant' ? d.tenant.oid : null;

    return deliveryConfigLock.usingLock(
      `${d.slate.oid}:${d.triggerGroup.key}:${tenantOid ?? 'global'}:${oauthClientId}`,
      async () => {
        let existing = await db.slateWebhookRegistration.findFirst({
          where: {
            type: 'delivery_config',
            status: { in: ['active', 'awaiting_setup'] },
            owner: d.owner,
            tenantOid,
            slateOid: d.slate.oid,
            oauthClientId,
            triggerGroup: { key: d.triggerGroup.key }
          },
          select: { id: true }
        });
        if (existing) {
          throw new ServiceError(
            conflictError({
              code: 'delivery_config_already_exists',
              message:
                'A delivery setup for this integration and OAuth app already exists. Remove it before creating another.'
            })
          );
        }

        return fn();
      },
      deliveryConfigLockOptions
    );
  }

  private async resolveManualWebhookTriggerGroup(d: { slateId: string }) {
    let slate = await slateService.getSlateById({ id: d.slateId });
    let version = await getActiveSlateVersion({ slate });

    if (!version.specificationOid) {
      throw new ServiceError(
        badRequestError({ message: 'Provider version has no specification set.' })
      );
    }

    let triggerGroups = await db.slateTriggerGroup.findMany({
      where: {
        slateOid: slate.oid,
        slateSpecifications: { some: { specificationOid: version.specificationOid } }
      }
    });
    let manualWebhookTriggerGroups = triggerGroups.filter(
      tg => getManualWebhookRegistrationSpec(tg) !== null
    );

    if (manualWebhookTriggerGroups.length === 0) {
      throw new ServiceError(
        badRequestError({
          message: 'The provider does not support webhook registration.'
        })
      );
    }
    if (manualWebhookTriggerGroups.length > 1) {
      throw new Error('WTF - multiple manual webhook trigger groups found for provider');
    }

    return { slate, triggerGroup: manualWebhookTriggerGroups[0]! };
  }

  private async startWebhookSetup(d: {
    tenant: Tenant;
    slate: Slate;
    triggerGroup: SlateTriggerGroup;
    urlKey: string;
  }) {
    let version = await getActiveSlateVersion({ slate: d.slate });

    let setupRes = await slateInvocationService.startManualWebhookRegistration({
      stack: await slateInvocationService.createInvocation({
        participants: [],
        slateVersion: version,
        tenant: d.tenant
      }),
      triggerGroupId: d.triggerGroup.key,
      webhookUrl: getWebhookUrl({ urlKey: d.urlKey })
    });

    if (setupRes.status === 'error') {
      throw new ServiceError(
        badRequestError({
          message: `Unable to start webhook setup: ${setupRes.error.message}`
        })
      );
    }

    return {
      partialWebhookRegistrationPayload: setupRes.data.partialWebhookRegistrationPayload,
      webhookSetupDocument: setupRes.data.webhookSetupDocument
    };
  }

  private async callManualFinishRpc(d: {
    tenant: Tenant;
    slate: Slate;
    triggerGroup: SlateTriggerGroup;
    urlKey: string;
    partialWebhookRegistrationPayload: any;
    userConfig: Record<string, any>;
  }) {
    let registrationSpec = getManualWebhookRegistrationSpec(d.triggerGroup);
    if (!registrationSpec) {
      throw new ServiceError(
        badRequestError({
          message: 'This trigger group no longer supports manual webhook registration.'
        })
      );
    }

    // A pasted value often carries whitespace that a schema pattern would reject.
    let trimmed = Object.fromEntries(
      Object.entries(d.userConfig).map(([key, value]) => [
        key,
        typeof value === 'string' ? value.trim() : value
      ])
    );

    let userConfig = validateJsonSchema({
      schema: registrationSpec.userConfigSchema,
      data: trimmed,
      entity: 'webhook_registration.user_config',
      message: 'Invalid webhook setup configuration.'
    });

    let version = await getActiveSlateVersion({ slate: d.slate });

    let finishRes = await slateInvocationService.finishManualWebhookRegistration({
      stack: await slateInvocationService.createInvocation({
        participants: [],
        slateVersion: version,
        tenant: d.tenant
      }),
      triggerGroupId: d.triggerGroup.key,
      webhookUrl: getWebhookUrl({ urlKey: d.urlKey }),
      partialWebhookRegistrationPayload: d.partialWebhookRegistrationPayload,
      userWebhookRegistrationPayload: userConfig
    });

    if (finishRes.status === 'error') {
      throw new ServiceError(
        badRequestError({
          message: `Unable to finish webhook setup: ${finishRes.error.message}`
        })
      );
    }

    return finishRes.data.webhookRegistrationPayload;
  }
}

export let slateWebhookRegistrationService = Service.create(
  'slateWebhookRegistrationService',
  () => new slateWebhookRegistrationServiceImpl()
).build();
