import { ServiceError, badRequestError } from '@lowerdeck/error';
import { providerAuthConfigService } from '@metorial-subspace/module-auth';
import { providerService, providerVersionService } from '@metorial-subspace/module-catalog';
import {
  providerConfigService,
  providerConfigVaultService,
  providerDeploymentService
} from '@metorial-subspace/module-deployment';
import type { SessionProviderInput } from '@metorial-subspace/module-session';
import type { AuditScope } from '@metorial/audit-scope';
import type { Instance } from '@metorial/db';

export type SessionProviderDeploymentSource =
  | { type: 'reference'; providerDeploymentId: string }
  | {
      type: 'ephemeral';
      providerId: string;
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      lockedProviderVersionId?: string;
    };

export type SessionProviderConfigSource =
  | { type: 'reference'; providerConfigId: string }
  | {
      type: 'ephemeral';
      name?: string;
      config:
        | { type: 'inline'; data: Record<string, any> }
        | { type: 'vault'; providerConfigVaultId: string };
    };

export type SessionProviderAuthConfigSource =
  | { type: 'reference'; providerAuthConfigId: string }
  | {
      type: 'ephemeral';
      name?: string;
      providerAuthMethodId: string;
      providerId?: string;
      credentials: Record<string, any>;
    };

export let resolveSessionProviderInput = async (d: {
  instance: Instance;
  auditScope?: AuditScope;
  sessionTemplateId?: string;
  providerDeployment?: SessionProviderDeploymentSource;
  providerConfig?: SessionProviderConfigSource;
  providerAuthConfig?: SessionProviderAuthConfigSource;
  toolFilters?: PrismaJson.ToolFilter | null;
}): Promise<SessionProviderInput> => {
  let deploymentId: string | undefined;
  if (d.providerDeployment?.type === 'ephemeral') {
    let provider = await providerService.getProviderById({
      instance: d.instance,
      providerId: d.providerDeployment.providerId
    });
    let lockedVersion = d.providerDeployment.lockedProviderVersionId
      ? await providerVersionService.getProviderVersionById({
          instance: d.instance,
          providerVersionId: d.providerDeployment.lockedProviderVersionId
        })
      : undefined;

    let deployment = await providerDeploymentService.createProviderDeployment({
      instance: d.instance,
      auditScope: d.auditScope,
      provider,
      lockedVersion,
      input: {
        name: d.providerDeployment.name ?? `Ephemeral deployment for ${provider.name}`,
        description: d.providerDeployment.description,
        metadata: d.providerDeployment.metadata,
        isEphemeral: true,
        config: { type: 'none' }
      }
    });
    deploymentId = deployment.id;
  } else if (d.providerDeployment?.type === 'reference') {
    await providerDeploymentService.getProviderDeploymentById({
      instance: d.instance,
      providerDeploymentId: d.providerDeployment.providerDeploymentId
    });
    deploymentId = d.providerDeployment.providerDeploymentId;
  }

  let configId: string | undefined;
  let configHasEphemeral = false;
  if (d.providerConfig?.type === 'reference') {
    configId = d.providerConfig.providerConfigId;
  } else if (d.providerConfig?.type === 'ephemeral') {
    let provider = deploymentId
      ? await providerService.getProviderById({
          instance: d.instance,
          providerId: deploymentId
        })
      : undefined;
    let providerDeployment = deploymentId
      ? await providerDeploymentService.getProviderDeploymentById({
          instance: d.instance,
          providerDeploymentId: deploymentId
        })
      : undefined;

    if (!provider && providerDeployment?.provider) {
      provider = await providerService.getProviderById({
        instance: d.instance,
        providerId: providerDeployment.provider.id
      });
    }

    if (!provider) {
      throw new ServiceError(
        badRequestError({
          message: 'Unable to resolve provider. Please provide a valid provider ID.'
        })
      );
    }

    let config =
      d.providerConfig.config.type === 'inline'
        ? d.providerConfig.config
        : {
            type: 'vault' as const,
            vault: await providerConfigVaultService.getProviderConfigVaultById({
              instance: d.instance,
              providerConfigVaultId: d.providerConfig.config.providerConfigVaultId
            })
          };
    let newConfig = await providerConfigService.createProviderConfig({
      instance: d.instance,
      auditScope: d.auditScope,
      provider,
      providerDeployment,
      input: {
        name: d.providerConfig.name ?? 'Ephemeral config',
        isEphemeral: true,
        config
      }
    });
    configId = newConfig.id;
    configHasEphemeral = true;
  }

  let authConfigId: string | undefined;
  let authConfigHasEphemeral = false;
  if (d.providerAuthConfig?.type === 'reference') {
    authConfigId = d.providerAuthConfig.providerAuthConfigId;
  }
  if (d.providerAuthConfig?.type === 'ephemeral') {
    let providerId = d.providerAuthConfig.providerId || deploymentId;
    let provider = providerId
      ? await providerService.getProviderById({
          instance: d.instance,
          providerId
        })
      : undefined;
    let providerDeployment = deploymentId
      ? await providerDeploymentService.getProviderDeploymentById({
          instance: d.instance,
          providerDeploymentId: deploymentId
        })
      : undefined;

    if (!provider && providerDeployment) {
      provider = await providerService.getProviderById({
        instance: d.instance,
        providerId: providerDeployment.provider.id
      });
    }

    if (!provider) {
      throw new ServiceError(
        badRequestError({
          message: 'Unable to resolve provider. Please provide a valid provider ID.'
        })
      );
    }

    let authConfig = await providerAuthConfigService.createProviderAuthConfig({
      instance: d.instance,
      auditScope: d.auditScope,
      provider,
      providerDeployment,
      source: 'manual',
      import: {
        ip: undefined,
        ua: undefined,
        note: 'Created via ephemeral provider configuration'
      },
      input: {
        name: d.providerAuthConfig.name ?? 'Ephemeral auth config',
        authMethodId: d.providerAuthConfig.providerAuthMethodId,
        isEphemeral: true,
        config: d.providerAuthConfig.credentials
      }
    });
    authConfigId = authConfig.id;
    authConfigHasEphemeral = true;
  }

  return {
    sessionTemplateId: d.sessionTemplateId,
    deploymentId,
    configId,
    authConfigId,
    toolFilters: d.toolFilters,
    // The former RPC resolver checked `deployment.isEphemeral` on its wrapper result,
    // where the corresponding flag was named `hasEphemeral`. Preserve that oddity.
    __allowEphemeral: configHasEphemeral || authConfigHasEphemeral
  };
};
