import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { generateCustomId } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  Slate,
  SlateTriggerGroup,
  SlateWebhookRegistration,
  SlateWebhookRegistrationAuthRouting,
  SlateWebhookRegistrationOwner,
  SlateWebhookRegistrationType,
  Tenant
} from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import { triggerWebhookRegistrationServiceInternal } from '../internal';
import { getActiveSlateVersion } from '../lib/slateVersion';
import { validateJsonSchema } from '../lib/validateJsonSchema';
import { getWebhookUrl } from '../lib/webhookUrl';
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
) => `${generateCustomId(owner === 'global' ? 'whk_global_' : 'whk_')}_${getRegion()}`;

let getManualWebhookRegistrationSpec = (triggerGroup: SlateTriggerGroup) => {
  let invocation = triggerGroup.spec.invocation;
  if (invocation.type !== 'webhook' || invocation.registration.mode !== 'manual') return null;
  return invocation.registration;
};

class slateWebhookRegistrationServiceImpl {
  async getWebhookRegistrationById(d: {
    tenant: Tenant;
    id: string;
    type?: SlateWebhookRegistrationType;
  }) {
    let registration = await db.slateWebhookRegistration.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        owner: 'tenant',
        id: d.id,
        status: { not: 'deleted' },
        type: d.type
      },
      include
    });
    if (!registration) throw new ServiceError(notFoundError('slate.webhook_registration'));
    return registration;
  }

  async getWebhookRegistrationByUrlKey(d: { urlKey: string }) {
    let registration = await db.slateWebhookRegistration.findUnique({
      where: { urlKey: d.urlKey },
      include
    });
    if (!registration) throw new ServiceError(notFoundError('slate.webhook_registration'));
    return registration;
  }

  async listWebhookRegistrations(d: { tenant: Tenant; type?: SlateWebhookRegistrationType }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateWebhookRegistration.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              owner: 'tenant',
              status: { not: 'deleted' },
              type: d.type
            },
            include
          })
      )
    );
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
    };
  }) {
    let { slate, triggerGroup } = await this.resolveManualWebhookTriggerGroup({
      slateId: d.input.slateId
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

    let urlKey = generateWebhookRegistrationUrlKey('tenant');

    let { partialWebhookRegistrationPayload, webhookSetupDocument } =
      await this.startWebhookSetup({
        tenant: d.tenant,
        slate,
        triggerGroup,
        urlKey
      });

    let registration =
      await triggerWebhookRegistrationServiceInternal.createWebhookRegistration({
        tenant: d.tenant,
        slate,
        triggerGroup,
        type: 'manual',
        owner: 'tenant',
        status: 'awaiting_setup',
        urlKey,

        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata,

        webhookRegistrationPayload: partialWebhookRegistrationPayload,
        authMethods,
        oauthCredentials
      });

    return { registration, webhookSetupDocument };
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

    return triggerWebhookRegistrationServiceInternal.finalizeWebhookRegistration({
      tenant: d.tenant,
      registration: d.registration,
      webhookRegistrationPayload
    });
  }

  async createGlobalWebhookRegistration(d: {
    input: {
      slateId: string;
      name: string;
      description?: string;
      metadata?: Record<string, any>;
      userConfig: Record<string, any>;
      authRouting?: SlateWebhookRegistrationAuthRouting;
      authMethodIds?: string[];
    };
  }) {
    let { slate, triggerGroup } = await this.resolveManualWebhookTriggerGroup({
      slateId: d.input.slateId
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
      type: 'manual',
      owner: 'global',
      status: 'active',
      urlKey,

      name: d.input.name,
      description: d.input.description,
      metadata: d.input.metadata,

      webhookRegistrationPayload,
      authMethods
    });
  }

  async getGlobalWebhookRegistrationById(d: { id: string }) {
    let registration = await db.slateWebhookRegistration.findFirst({
      where: { id: d.id, owner: 'global', status: { not: 'deleted' } },
      include
    });
    if (!registration) throw new ServiceError(notFoundError('slate.webhook_registration'));
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

  async deleteGlobalWebhookRegistration(d: { registration: { oid: bigint } }) {
    await db.slateWebhookRegistration.update({
      where: { oid: d.registration.oid },
      data: { status: 'deleted' }
    });
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
      throw new ServiceError(notFoundError('slate.webhook_registration'));
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
    registration: { oid: bigint; tenantOid: bigint | null };
  }) {
    if (d.registration.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('slate.webhook_registration'));
    }

    await db.slateWebhookRegistration.update({
      where: { oid: d.registration.oid },
      data: { status: 'deleted' }
    });
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

    let userConfig = validateJsonSchema({
      schema: registrationSpec.userConfigSchema,
      data: d.userConfig,
      entity: 'slate.webhook_registration.user_config',
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
