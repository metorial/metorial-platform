import { Context } from '@metorial/context';
import {
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import {
  ID,
  MagicMcpServer,
  Organization,
  OrganizationActor,
  db,
  type Instance
} from '@metorial/db';
import { type AnyAccessTagSelector } from '@metorial/module-access';
import { magicMcpServerService } from '@metorial/module-magic';
import { env as portalEnv } from '@metorial/module-portal/src/env';
import { buildPortalUrlFromTemplate } from '@metorial/module-portal/src/portalUrlTemplate';
import {
  subspaceProviderAuthConfigService,
  subspaceProviderSetupSessionService,
  subspaceSessionTemplateProviderService,
  subspaceSessionTemplateService
} from '@metorial/module-subspace';
import { subspaceProviderConfigService } from '@metorial/module-subspace';
import { consumerAccessPolicyService } from '../accessPolicy';
import { buildConsumerMagicMcpServerCreateInput } from './magicMcpServerInput';
import {
  getDefaultOauthMethod,
  getValidatedConsumerProviderSetupSession,
  resolveConsumerProviderTemplateContext
} from './providerContext';
import type { ConsumerProviderProvisionResource } from './types';

type ConsumerProviderProvisionArtifacts = {
  providerConfig?: ConsumerProviderProvisionResource;
  providerAuthConfig?: ConsumerProviderProvisionResource;
  providerAuthConfigId?: string;
  sessionTemplate?: ConsumerProviderProvisionResource;
  sessionTemplateProviderId?: string;
  magicMcpServer?: MagicMcpServer;
};

let compensateFailedProvision = async (d: {
  instance: Instance;
  artifacts: ConsumerProviderProvisionArtifacts;
}) => {
  await Promise.all([
    d.artifacts.magicMcpServer
      ? magicMcpServerService.archiveMagicMcpServer({
          server: d.artifacts.magicMcpServer
        })
      : Promise.resolve(),
    d.artifacts.sessionTemplateProviderId
      ? subspaceSessionTemplateProviderService.delete({
          instance: d.instance,
          sessionTemplateProviderId: d.artifacts.sessionTemplateProviderId
        })
      : Promise.resolve()
  ]);
};

export let createConsumerProviderSetupSession = async (d: {
  instance: Instance;
  context: Context;
  accessTags: AnyAccessTagSelector;
  consumerSurfaceOid: bigint;
  consumerProfileId: string;
  providerTemplateId: string;
  input: {
    providerAuthMethodId?: string;
  };
}) => {
  let providerContext = await resolveConsumerProviderTemplateContext({
    instance: d.instance,
    accessTags: d.accessTags,
    providerTemplateId: d.providerTemplateId,
    includeAuthMethods: true
  });

  let authMethod =
    (d.input.providerAuthMethodId
      ? providerContext.authMethods.find(method => method.id == d.input.providerAuthMethodId)
      : getDefaultOauthMethod(providerContext.authMethods)) ?? null;

  if (!authMethod || authMethod.type != 'oauth') {
    throw new ServiceError(
      preconditionFailedError({
        message: 'This provider template does not expose an OAuth setup flow.'
      })
    );
  }

  let portal = await db.portal.findFirst({
    where: {
      instanceOid: d.instance.oid,
      surfaceOid: d.consumerSurfaceOid
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
    redirectUrl: buildPortalUrlFromTemplate(portalEnv.portal.PORTAL_HOST_TEMPLATE, portal.slug)
  });

  await db.consumerProviderSetupSessionBinding.create({
    data: {
      id: await ID.generateId('consumerProviderSetupSessionBinding'),
      providerSetupSessionId: setupSession.id,
      consumerProfileId: d.consumerProfileId,
      providerTemplateId: providerContext.providerTemplate.id,
      providerId: providerContext.provider.id,
      providerDeploymentId: providerContext.deployment.id,
      instanceOid: d.instance.oid
    }
  });

  return setupSession;
};

export let getConsumerProviderSetupSession = async (d: {
  instance: Instance;
  accessTags: AnyAccessTagSelector;
  consumerProfileId: string;
  providerTemplateId: string;
  providerSetupSessionId: string;
}) => {
  let providerContext = await resolveConsumerProviderTemplateContext({
    instance: d.instance,
    accessTags: d.accessTags,
    providerTemplateId: d.providerTemplateId
  });

  return await getValidatedConsumerProviderSetupSession({
    instance: d.instance,
    providerSetupSessionId: d.providerSetupSessionId,
    consumerProfileId: d.consumerProfileId,
    providerTemplateId: providerContext.providerTemplate.id,
    providerId: providerContext.provider.id,
    providerDeploymentId: providerContext.deployment.id
  });
};

export let deployConsumerProvider = async (d: {
  organization: Organization;
  performedBy: OrganizationActor;
  instance: Instance;
  context: Context;
  consumerProfile: {
    id: string;
    email: string;
    oid: bigint;
    personalConsumerGroupOid: bigint;
  };
  accessTags: AnyAccessTagSelector;
  providerTemplateId: string;
  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, unknown>;
    config?: Record<string, unknown>;
    auth?:
      | {
          type: 'setup_session';
          providerSetupSessionId: string;
        }
      | {
          type: 'manual';
          providerAuthMethodId: string;
          value: Record<string, unknown>;
        };
  };
}) => {
  let providerContext = await resolveConsumerProviderTemplateContext({
    instance: d.instance,
    accessTags: d.accessTags,
    providerTemplateId: d.providerTemplateId,
    includeAuthMethods: true,
    includeConfigSchema: true
  });

  let hasConfigSchema = !!Object.keys(providerContext.configSchema?.configSchema ?? {}).length;
  let hasInputConfig = d.input.config != undefined;
  if (hasConfigSchema && !providerContext.deployment.defaultConfig && !hasInputConfig) {
    throw new ServiceError(
      preconditionFailedError({
        message: 'This provider template requires configuration before deployment.'
      })
    );
  }

  if (!d.input.auth && providerContext.authMethods.length > 0) {
    throw new ServiceError(
      preconditionFailedError({
        message: 'This provider template requires authentication before deployment.'
      })
    );
  }

  let artifacts: ConsumerProviderProvisionArtifacts = {};

  try {
    if (hasInputConfig) {
      let createdProviderConfig = await subspaceProviderConfigService.create({
        instance: d.instance,
        providerId: providerContext.provider.id,
        providerDeployment: {
          type: 'reference',
          providerDeploymentId: providerContext.deployment.id
        },
        name: `${providerContext.provider.name} Config`,
        description: `Portal configuration for ${providerContext.provider.name}`,
        config: {
          type: 'inline',
          data: d.input.config ?? {}
        }
      });

      artifacts.providerConfig = {
        id: createdProviderConfig.id
      };
    }

    let authInput = d.input.auth;

    if (authInput?.type == 'setup_session') {
      let setupSession = await getValidatedConsumerProviderSetupSession({
        instance: d.instance,
        providerSetupSessionId: authInput.providerSetupSessionId,
        consumerProfileId: d.consumerProfile.id,
        providerTemplateId: providerContext.providerTemplate.id,
        providerId: providerContext.provider.id,
        providerDeploymentId: providerContext.deployment.id,
        requireCompleted: true
      });

      artifacts.providerAuthConfigId = setupSession.authConfig!.id;
    } else if (authInput?.type == 'manual') {
      let authMethod = providerContext.authMethods.find(candidate => {
        return candidate.id == authInput.providerAuthMethodId;
      });

      if (!authMethod) {
        throw new ServiceError(notFoundError('provider.auth_method'));
      }

      let authConfig = await subspaceProviderAuthConfigService.create({
        instance: d.instance,
        providerId: providerContext.provider.id,
        providerAuthMethodId: authMethod.id,
        providerDeployment: {
          type: 'reference',
          providerDeploymentId: providerContext.deployment.id
        },
        name: `${providerContext.provider.name} Auth`,
        description: `Portal authentication for ${providerContext.provider.name}`,
        ip: d.context.ip,
        ua: d.context.ua ?? '',
        config: authInput.value
      });

      artifacts.providerAuthConfig = {
        id: authConfig.id
      };
      artifacts.providerAuthConfigId = authConfig.id;
    }

    let createdSessionTemplate = await subspaceSessionTemplateService.create({
      instance: d.instance,
      name: d.input.name ?? providerContext.providerTemplate.name,
      description:
        d.input.description ??
        providerContext.providerTemplate.description ??
        providerContext.provider.description ??
        undefined,
      metadata: d.input.metadata ?? {},
      providers: []
    });

    artifacts.sessionTemplate = {
      id: createdSessionTemplate.id
    };

    let sessionTemplateProvider = await subspaceSessionTemplateProviderService.create({
      instance: d.instance,
      sessionTemplateId: artifacts.sessionTemplate.id,
      providerDeploymentId: providerContext.deployment.id,
      providerConfigId: artifacts.providerConfig?.id,
      providerAuthConfigId: artifacts.providerAuthConfigId
    });
    artifacts.sessionTemplateProviderId = sessionTemplateProvider.id;

    artifacts.magicMcpServer = await magicMcpServerService.createMagicMcpServer({
      organization: d.organization,
      performedBy: d.performedBy,
      instance: d.instance,
      context: d.context,
      input: {
        ...buildConsumerMagicMcpServerCreateInput({
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,
          providerName: providerContext.provider.name,
          providerDescription: providerContext.provider.description,
          providerTemplateDescription: providerContext.providerTemplate.description,
          providerDeploymentDescription: providerContext.deployment.description,
          providerTemplateId: providerContext.providerTemplate.id
        }),
        sessionTemplateId: artifacts.sessionTemplate.id
      }
    });

    for (let permission of ['magic_mcp_read', 'magic_mcp_write'] as const) {
      await consumerAccessPolicyService.grantAccess({
        organization: d.organization,
        permission,
        subject: {
          personalConsumerGroupForProfile: d.consumerProfile
        },
        resource: {
          magicMcpServer: artifacts.magicMcpServer
        }
      });
    }

    return artifacts.magicMcpServer;
  } catch (error) {
    try {
      await compensateFailedProvision({
        instance: d.instance,
        artifacts
      });
    } catch (compensationError) {
      throw new AggregateError(
        [error, compensationError],
        'Consumer provider provisioning failed and cleanup was incomplete.'
      );
    }

    throw error;
  }
};
