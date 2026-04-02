import {
  notFoundError,
  preconditionFailedError,
  ServiceError,
  unauthorizedError
} from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { Context } from '@metorial/context';
import {
  ConsumerProfile,
  ConsumerSurface,
  db,
  ID,
  ProviderTemplate,
  type Instance
} from '@metorial/db';
import { type AnyAccessTagSelector } from '@metorial/module-access';
import { subspaceProviderSetupSessionService } from '@metorial/module-subspace';
import {
  getDefaultOauthMethod,
  loadTemplateContextForSetup,
  type ConsumerProviderAuthMethodList
} from './consumerProviderContext';

let buildProviderSetupRedirectUrl = (portalSlug: string) => {
  let template = process.env.PORTAL_HOST_TEMPLATE;
  if (!template) {
    throw new Error('PORTAL_HOST_TEMPLATE is required');
  }

  let raw = template.replace(/\/+$/, '');

  if (!raw.includes('{portalId}')) {
    let url = new URL(raw);
    let pathname = `${url.pathname.replace(/\/+$/, '')}/p/{portalId}`.replace(/\/{2,}/g, '/');

    raw = `${url.origin}${pathname}${url.search}${url.hash}`.replace(/\/+$/, '');
  }

  return raw.replace('{portalId}', portalSlug).replace(/\/+$/, '');
};

let getRequestedOauthMethod = (d: {
  authMethods: ConsumerProviderAuthMethodList;
  providerAuthMethodId?: string;
}) => {
  let authMethod = d.providerAuthMethodId
    ? (d.authMethods.find(method => method.id == d.providerAuthMethodId) ?? null)
    : getDefaultOauthMethod(d.authMethods);

  if (!authMethod || authMethod.type != 'oauth') {
    throw new ServiceError(
      preconditionFailedError({
        message: 'This provider template does not expose an OAuth setup flow.'
      })
    );
  }

  return authMethod;
};

let assertSetupSessionBindingMatchesConsumerProvider = (d: {
  binding: {
    consumerProfileOid: bigint;
    providerTemplateOid: bigint;
  } | null;
  consumerProfile: Pick<ConsumerProfile, 'oid'>;
  providerTemplate: Pick<ProviderTemplate, 'oid'>;
}) => {
  if (!d.binding || d.binding.consumerProfileOid != d.consumerProfile.oid) {
    throw new ServiceError(
      unauthorizedError({
        message: 'The selected provider setup session does not belong to this consumer.'
      })
    );
  }

  if (d.binding.providerTemplateOid != d.providerTemplate.oid) {
    throw new ServiceError(
      unauthorizedError({
        message: 'The selected provider setup session does not belong to this template.'
      })
    );
  }
};

class ConsumerProviderSetupSessionServiceImpl {
  async startSetupSession(d: {
    instance: Instance;
    context: Context;
    accessTags: AnyAccessTagSelector;
    consumerSurface: ConsumerSurface;
    consumerProfile: ConsumerProfile;
    providerTemplateId: string;
    input: {
      providerAuthMethodId?: string;
    };
  }) {
    let providerContext = await loadTemplateContextForSetup({
      instance: d.instance,
      accessTags: d.accessTags,
      providerTemplateId: d.providerTemplateId
    });
    let authMethod = getRequestedOauthMethod({
      authMethods: providerContext.authMethods,
      providerAuthMethodId: d.input.providerAuthMethodId
    });
    let portal = await db.portal.findFirst({
      where: {
        instanceOid: d.instance.oid,
        surfaceOid: d.consumerSurface.oid
      },
      select: {
        slug: true
      }
    });

    if (!portal) {
      throw new ServiceError(notFoundError('portal'));
    }

    let setupSession = await subspaceProviderSetupSessionService.create({
      instance: d.instance,
      providerId: providerContext.provider.id,
      providerDeploymentId: providerContext.deployment.id,
      providerAuthMethodId: authMethod.id,
      name: providerContext.provider.name,
      description: providerContext.provider.description ?? undefined,
      uiMode: 'metorial_elements',
      type: 'auth_only',
      ip: d.context.ip,
      ua: d.context.ua ?? '',
      redirectUrl: buildProviderSetupRedirectUrl(portal.slug)
    });

    await db.consumerProviderSetupSessionBinding.create({
      data: {
        id: await ID.generateId('consumerProviderSetupSessionBinding'),
        providerSetupSessionId: setupSession.id,
        consumerProfileOid: d.consumerProfile.oid,
        providerTemplateOid: providerContext.providerTemplate.oid,
        instanceOid: d.instance.oid
      }
    });

    return setupSession;
  }

  async getSetupSession(d: {
    instance: Instance;
    consumerProfile: Pick<ConsumerProfile, 'oid'>;
    providerTemplate: Pick<ProviderTemplate, 'oid'>;
    providerSetupSessionId: string;
  }) {
    return await this.getBoundSetupSession({
      instance: d.instance,
      providerSetupSessionId: d.providerSetupSessionId,
      consumerProfile: d.consumerProfile,
      providerTemplate: d.providerTemplate
    });
  }

  async getCompletedSetupSession(d: {
    instance: Instance;
    consumerProfile: Pick<ConsumerProfile, 'oid'>;
    providerTemplate: Pick<ProviderTemplate, 'oid'>;
    providerSetupSessionId: string;
  }) {
    return await this.getBoundSetupSession({
      ...d,
      requireCompleted: true
    });
  }

  private async getBoundSetupSession(d: {
    instance: Instance;
    providerSetupSessionId: string;
    consumerProfile: Pick<ConsumerProfile, 'oid'>;
    providerTemplate: Pick<ProviderTemplate, 'oid'>;
    requireCompleted?: boolean;
  }) {
    let setupSession = await subspaceProviderSetupSessionService.get({
      instance: d.instance,
      providerSetupSessionId: d.providerSetupSessionId
    });
    let binding = await db.consumerProviderSetupSessionBinding.findUnique({
      where: {
        instanceOid_providerSetupSessionId: {
          instanceOid: d.instance.oid,
          providerSetupSessionId: d.providerSetupSessionId
        }
      }
    });

    if (
      d.requireCompleted &&
      (setupSession.status != 'completed' || !setupSession.authConfig?.id)
    ) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'The selected provider setup session is not completed yet.'
        })
      );
    }

    assertSetupSessionBindingMatchesConsumerProvider({
      binding,
      consumerProfile: d.consumerProfile,
      providerTemplate: d.providerTemplate
    });

    return setupSession;
  }
}

export let consumerProviderSetupSessionService = Service.create(
  'consumerProviderSetupSessionService',
  () => new ConsumerProviderSetupSessionServiceImpl()
).build();
