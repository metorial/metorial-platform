import { preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { Context } from '@metorial/context';
import {
  ConsumerProfile,
  MagicMcpServer,
  Organization,
  OrganizationActor,
  db,
  type Instance
} from '@metorial/db';
import { type AnyAccessTagSelector } from '@metorial/module-access';
import { magicMcpServerService } from '@metorial/module-magic';
import {
  loadTemplateContextForDeployment,
  type ConsumerProviderTemplateContext
} from '../../lib/consumerProviderContext';
import { consumerAccessPolicyService } from '../consumerAccess/accessPolicy';
import { consumerIntegrationService } from './consumerIntegration';
import { consumerProviderSetupSessionService } from './consumerProviderSetupSession';

type ConsumerProviderDeployRollbackState = {
  magicMcpServer?: MagicMcpServer;
};

type ConsumerProviderDeployInput = {
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  integrationSetupSessionId: string;
};

type SetupSessionIntegrationInstanceProvider = {
  currentVersion?: {
    integrationProviderVersion?: {
      deployment?: {
        id?: string | null;
      } | null;
    } | null;
    config?: {
      id?: string | null;
    } | null;
    authConfig?: {
      id?: string | null;
    } | null;
    toolFilter?: unknown;
  } | null;
  integrationProvider?: {
    currentVersion?: {
      deployment?: {
        id?: string | null;
      } | null;
      config?: {
        id?: string | null;
      } | null;
    } | null;
  } | null;
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
  let schema = providerContext.configSchema?.value.specification.configJsonSchema as
    | {
        properties?: Record<string, unknown>;
      }
    | null
    | undefined;

  return !!Object.keys(schema?.properties ?? {}).length;
};

let assertProviderCanBeDeployed = (providerContext: ConsumerProviderTemplateContext) => {
  let requiresConfig =
    hasProviderConfigFields(providerContext) && !providerContext.deployment.defaultConfig;

  if (requiresConfig && !providerContext.providerTemplate.subspaceIntegrationId) {
    throw new ServiceError(
      preconditionFailedError({
        message: 'This provider template requires integration setup before deployment.'
      })
    );
  }
};

let getIntegrationInstanceProviders = (setupSession: any) =>
  (setupSession.integrationInstance?.integrationInstanceProviders ??
    setupSession.integrationInstance?.providers ??
    []) as SetupSessionIntegrationInstanceProvider[];

let assertActiveSetupSessionInstance = (setupSession: any) => {
  if (setupSession.status != 'successful') {
    throw new ServiceError(
      preconditionFailedError({
        message: 'The selected setup session is not completed yet.'
      })
    );
  }

  if (!setupSession.integrationInstance) {
    throw new ServiceError(
      preconditionFailedError({
        message: 'The selected setup session did not create an integration instance.'
      })
    );
  }

  if (setupSession.integrationInstance.status != 'active') {
    throw new ServiceError(
      preconditionFailedError({
        message:
          setupSession.integrationInstance.status == 'draft'
            ? 'The selected setup session is still a draft and cannot be deployed yet.'
            : 'The selected setup session integration instance is not active.'
      })
    );
  }

  if (!getIntegrationInstanceProviders(setupSession).length) {
    throw new ServiceError(
      preconditionFailedError({
        message: 'The selected integration setup session did not configure any providers.'
      })
    );
  }
};

let getConsumerOwnerForProfile = async (d: {
  instance: Instance;
  consumerProfile: ConsumerProfile;
}) => {
  let actor = await db.consumerActor.findFirst({
    where: {
      instanceOid: d.instance.oid,
      consumerProfileOid: d.consumerProfile.oid,
      isDefault: true
    },
    select: {
      id: true,
      defaultIdentityId: true
    }
  });

  return {
    identityActorId: actor?.id ?? null,
    identityId: actor?.defaultIdentityId ?? null
  };
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

    assertProviderCanBeDeployed(providerContext);

    let rollbackState: ConsumerProviderDeployRollbackState = {};

    try {
      let setupSession = await consumerProviderSetupSessionService.getCompletedSetupSession({
        instance: d.instance,
        consumerProfile: d.consumerProfile,
        providerTemplate: providerContext.providerTemplate,
        integrationSetupSessionId: d.input.integrationSetupSessionId
      });

      assertActiveSetupSessionInstance(setupSession);

      let consumerOwner = await getConsumerOwnerForProfile({
        instance: d.instance,
        consumerProfile: d.consumerProfile
      });

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
          subspaceIntegrationInstanceId: setupSession.integrationInstance.id,
          consumerOwner
        }
      });

      rollbackState.magicMcpServer = magicMcpServer;

      await consumerIntegrationService.upsertConsumerIntegration({
        consumerProfile: d.consumerProfile,
        magicMcpServer,
        isManaged: true
      });

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

  private async rollbackFailedDeployment(d: {
    instance: Instance;
    rollbackState: ConsumerProviderDeployRollbackState;
  }) {
    await Promise.all([
      d.rollbackState.magicMcpServer
        ? magicMcpServerService.archiveMagicMcpServer({
            server: d.rollbackState.magicMcpServer
          })
        : Promise.resolve()
    ]);
  }
}

export let consumerProviderDeploymentService = Service.create(
  'consumerProviderDeploymentService',
  () => new ConsumerProviderDeploymentServiceImpl()
).build();
