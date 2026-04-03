import { notFoundError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
import { Service } from '@lowerdeck/service';
import { Context } from '@metorial/context';
import {
  ConsumerProfile,
  db,
  MagicMcpServer,
  Organization,
  OrganizationActor,
  type Instance
} from '@metorial/db';
import { type AnyAccessTagSelector } from '@metorial/module-access';
import { magicMcpServerService } from '@metorial/module-magic';
import {
  subspaceIdentityCredentialService,
  subspaceProviderAuthConfigService,
  subspaceProviderConfigService,
  subspaceSessionTemplateProviderService,
  subspaceSessionTemplateService
} from '@metorial/module-subspace';
import { consumerAccessPolicyService } from './accessPolicy';
import {
  loadTemplateContextForDeployment,
  type ConsumerProviderTemplateContext
} from './consumerProviderContext';
import { consumerProviderSetupSessionService } from './consumerProviderSetupSession';

let Sentry = getSentry();

type ConsumerProviderDeployRollbackState = {
  magicMcpServer?: MagicMcpServer;
  sessionTemplateProviderId?: string;
};

type ConsumerProviderDeployInput = {
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

let buildConsumerMagicMcpServerCreateInput = (d: {
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  providerName: string;
  providerDescription?: string | null;
  providerTemplateDescription?: string | null;
  providerDeploymentDescription?: string | null;
  providerTemplateId: string;
}) => {
  return {
    source: 'consumer_provider_template' as const,
    providerTemplateId: d.providerTemplateId,
    name: d.name ?? d.providerName,
    description:
      d.description ??
      d.providerTemplateDescription ??
      d.providerDeploymentDescription ??
      d.providerDescription ??
      undefined,
    metadata: d.metadata ?? {}
  };
};

let hasProviderConfigFields = (providerContext: ConsumerProviderTemplateContext) => {
  let schema = providerContext.configSchema?.configSchema as
    | {
        properties?: Record<string, unknown>;
      }
    | null
    | undefined;

  return !!Object.keys(schema?.properties ?? {}).length;
};

let assertProviderCanBeDeployed = (d: {
  providerContext: ConsumerProviderTemplateContext;
  input: ConsumerProviderDeployInput;
}) => {
  let requiresConfig =
    hasProviderConfigFields(d.providerContext) && !d.providerContext.deployment.defaultConfig;

  if (requiresConfig && d.input.config == undefined) {
    throw new ServiceError(
      preconditionFailedError({
        message: 'This provider template requires configuration before deployment.'
      })
    );
  }

  if (!d.input.auth && d.providerContext.authMethods.length > 0) {
    throw new ServiceError(
      preconditionFailedError({
        message: 'This provider template requires authentication before deployment.'
      })
    );
  }
};

class ConsumerProviderDeploymentServiceImpl {
  async deployProvider(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;
    context: Context;
    consumerProfile: ConsumerProfile;
    accessTags: AnyAccessTagSelector;
    providerTemplateId: string;
    input: ConsumerProviderDeployInput;
  }) {
    let providerContext = await loadTemplateContextForDeployment({
      instance: d.instance,
      accessTags: d.accessTags,
      providerTemplateId: d.providerTemplateId
    });

    assertProviderCanBeDeployed({
      providerContext,
      input: d.input
    });

    let rollbackState: ConsumerProviderDeployRollbackState = {};

    let instanceConsumer = await db.instanceConsumer.findFirst({
      where: {
        instanceOid: d.instance.oid,
        consumerOid: d.consumerProfile.consumerOid
      }
    });
    let consumerActor = instanceConsumer
      ? await db.consumerActor.findFirst({
          where: {
            instanceConsumerOid: instanceConsumer.oid,
            consumerProfileOid: d.consumerProfile.oid,
            isDefault: true
          }
        })
      : undefined;

    try {
      let providerConfigId = await this.createProviderConfig({
        instance: d.instance,
        providerContext,
        input: d.input
      });
      let providerAuthConfigId = await this.createProviderAuthConfig({
        instance: d.instance,
        context: d.context,
        consumerProfile: d.consumerProfile,
        providerContext,
        input: d.input
      });

      if (consumerActor?.defaultIdentityId) {
        try {
          await subspaceIdentityCredentialService.create({
            instance: d.instance,
            identityId: consumerActor.defaultIdentityId,
            deploymentId: providerContext.deployment.id,
            authConfigId: providerAuthConfigId,
            configId: providerConfigId
          });
        } catch (error) {
          Sentry.captureException(error, {
            tags: {
              module: 'consumerProviderDeployment',
              step: 'createIdentityCredential'
            },
            extra: {
              instanceId: d.instance.id,
              providerDeploymentId: providerContext.deployment.id,
              authConfigId: providerAuthConfigId,
              configId: providerConfigId
            }
          });
        }
      }

      let sessionTemplate = await subspaceSessionTemplateService.create({
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
      let sessionTemplateProvider = await subspaceSessionTemplateProviderService.create({
        instance: d.instance,
        sessionTemplateId: sessionTemplate.id,
        providerDeploymentId: providerContext.deployment.id,
        providerConfigId,
        providerAuthConfigId
      });

      rollbackState.sessionTemplateProviderId = sessionTemplateProvider.id;

      let magicMcpServer = await magicMcpServerService.createMagicMcpServer({
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
          sessionTemplateId: sessionTemplate.id
        }
      });

      rollbackState.magicMcpServer = magicMcpServer;

      await Promise.all(
        (['magic_mcp_read', 'magic_mcp_write'] as const).map(permission => {
          return consumerAccessPolicyService.grantAccess({
            organization: d.organization,
            permission,
            subject: {
              personalConsumerGroupForProfile: d.consumerProfile
            },
            resource: {
              magicMcpServer
            }
          });
        })
      );

      return magicMcpServer;
    } catch (error) {
      try {
        await this.rollbackFailedDeployment({
          instance: d.instance,
          rollbackState
        });
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          'Consumer provider provisioning failed and cleanup was incomplete.'
        );
      }

      throw error;
    }
  }

  private async createProviderConfig(d: {
    instance: Instance;
    providerContext: ConsumerProviderTemplateContext;
    input: ConsumerProviderDeployInput;
  }) {
    if (d.input.config == undefined) {
      return undefined;
    }

    let providerConfig = await subspaceProviderConfigService.create({
      instance: d.instance,
      providerId: d.providerContext.provider.id,
      providerDeployment: {
        type: 'reference',
        providerDeploymentId: d.providerContext.deployment.id
      },
      name: `${d.providerContext.provider.name} Config`,
      description: `Portal configuration for ${d.providerContext.provider.name}`,
      config: {
        type: 'inline',
        data: d.input.config
      }
    });

    return providerConfig.id;
  }

  private async createProviderAuthConfig(d: {
    instance: Instance;
    context: Context;
    consumerProfile: Pick<ConsumerProfile, 'oid'>;
    providerContext: ConsumerProviderTemplateContext;
    input: ConsumerProviderDeployInput;
  }) {
    let authInput = d.input.auth;

    if (!authInput) {
      return undefined;
    }

    if (authInput.type == 'setup_session') {
      let setupSession = await consumerProviderSetupSessionService.getCompletedSetupSession({
        instance: d.instance,
        consumerProfile: d.consumerProfile,
        providerTemplate: d.providerContext.providerTemplate,
        providerSetupSessionId: authInput.providerSetupSessionId
      });

      return setupSession.authConfig!.id;
    }

    let authMethod = d.providerContext.authMethods.find(method => {
      return method.id == authInput.providerAuthMethodId;
    });

    if (!authMethod) {
      throw new ServiceError(notFoundError('provider.auth_method'));
    }

    let authConfig = await subspaceProviderAuthConfigService.create({
      instance: d.instance,
      providerId: d.providerContext.provider.id,
      providerAuthMethodId: authMethod.id,
      providerDeployment: {
        type: 'reference',
        providerDeploymentId: d.providerContext.deployment.id
      },
      name: `${d.providerContext.provider.name} Auth`,
      description: `Portal authentication for ${d.providerContext.provider.name}`,
      ip: d.context.ip,
      ua: d.context.ua ?? '',
      config: authInput.value
    });

    return authConfig.id;
  }

  private async rollbackFailedDeployment(d: {
    instance: Instance;
    rollbackState: ConsumerProviderDeployRollbackState;
  }) {
    await Promise.all([
      d.rollbackState.magicMcpServer
        ? magicMcpServerService.archiveMagicMcpServer({
            server: d.rollbackState.magicMcpServer
          })
        : Promise.resolve(),
      d.rollbackState.sessionTemplateProviderId
        ? subspaceSessionTemplateProviderService.delete({
            instance: d.instance,
            sessionTemplateProviderId: d.rollbackState.sessionTemplateProviderId
          })
        : Promise.resolve()
    ]);
  }
}

export let consumerProviderDeploymentService = Service.create(
  'consumerProviderDeploymentService',
  () => new ConsumerProviderDeploymentServiceImpl()
).build();
