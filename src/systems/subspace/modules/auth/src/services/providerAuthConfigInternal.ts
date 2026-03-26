import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  type Backend,
  db,
  type Environment,
  getId,
  type Provider,
  type ProviderAuthConfigSource,
  type ProviderAuthConfigType,
  type ProviderAuthCredentials,
  type ProviderAuthImport,
  type ProviderAuthMethod,
  ProviderAuthMethodType,
  type ProviderDeployment,
  type ProviderDeploymentVersion,
  type ProviderVariant,
  type ProviderVersion,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkProviderMatch,
  providerDeploymentInternalService
} from '@metorial-subspace/module-provider-internal';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { getBackend } from '@metorial-subspace/provider';
import type { ProviderAuthConfigCreateRes } from '@metorial-subspace/provider-utils';
import { providerAuthConfigCreatedQueue } from '../queues/lifecycle/providerAuthConfig';
import { providerAuthConfigInclude } from './providerAuthConfig';

class providerAuthConfigInternalServiceImpl {
  async getVersionAndAuthMethod(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    provider: Provider & { defaultVariant: ProviderVariant | null };
    providerDeployment?: ProviderDeployment & {
      currentVersion:
        | (ProviderDeploymentVersion & { lockedVersion: ProviderVersion | null })
        | null;
    };
    authMethodId?: string;
  }) {
    let version = await providerDeploymentInternalService.getCurrentVersionOptional({
      provider: d.provider,
      environment: d.environment,
      deployment: d.providerDeployment
    });
    if (!version?.specificationOid) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider has not been discovered'
        })
      );
    }

    if (!d.authMethodId) {
      let authMethod = await db.providerAuthMethod.findFirst({
        where: {
          providerOid: d.provider.oid,
          specificationOid: version.specificationOid,
          isDefault: true
        },
        include: {
          specification: true
        }
      });
      if (!authMethod) {
        throw new ServiceError(
          badRequestError({
            message: 'Provider does not support authentication'
          })
        );
      }

      return { version, authMethod };
    }

    let authMethod = await db.providerAuthMethod.findFirst({
      where: {
        providerOid: d.provider.oid,
        specificationOid: version.specificationOid,
        OR: [
          { id: d.authMethodId },
          { specId: d.authMethodId },
          { specUniqueIdentifier: d.authMethodId },
          { key: d.authMethodId },
          { callableId: d.authMethodId },
          ...(ProviderAuthMethodType[d.authMethodId as keyof typeof ProviderAuthMethodType]
            ? [{ type: d.authMethodId as any }]
            : [])
        ]
      },
      include: {
        specification: true
      }
    });
    if (!authMethod) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid auth method for provider',
          code: 'invalid_auth_method'
        })
      );
    }

    return { version, authMethod };
  }

  async createProviderAuthConfigInternal(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    provider: Provider;
    providerDeployment?: ProviderDeployment;
    backend: Backend;
    type: ProviderAuthConfigType;
    source: ProviderAuthConfigSource;
    credentials?: ProviderAuthCredentials;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      isEphemeral?: boolean;
      isDefault?: boolean;
    };
    import?: {
      ip: string | undefined;
      ua: string | undefined;
      note?: string | undefined;
    };

    authMethod: ProviderAuthMethod;
    backendProviderAuthConfig: ProviderAuthConfigCreateRes;
  }) {
    checkTenant(d, d.providerDeployment);
    checkTenant(d, d.backendProviderAuthConfig.slateAuthConfig);
    checkTenant(d, d.backendProviderAuthConfig.shuttleAuthConfig);

    checkProviderMatch(d.provider, d.providerDeployment);
    checkProviderMatch(d.provider, d.authMethod);
    checkProviderMatch(d.provider, d.credentials);

    if (d.input.isDefault && !d.providerDeployment) {
      throw new ServiceError(
        badRequestError({
          message: 'Default auth configs must be associated with a deployment',
          code: 'invalid_default_auth_config'
        })
      );
    }
    if (d.input.isDefault && d.authMethod.type === 'oauth') {
      throw new ServiceError(
        badRequestError({
          message: 'OAuth auth methods cannot have default auth configs',
          code: 'invalid_default_auth_config'
        })
      );
    }

    return withTransaction(async db => {
      let providerAuthConfig = await db.providerAuthConfig.create({
        data: {
          ...getId('providerAuthConfig'),

          status: 'active',
          backendOid: d.backend.oid,

          type: d.type,
          source: d.source,

          name: d.input.name?.trim() || undefined,
          description: d.input.description?.trim() || undefined,
          metadata: d.input.metadata,

          isEphemeral: !!d.input.isEphemeral,
          isDefault: !!d.input.isDefault,

          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid,
          providerOid: d.provider.oid,
          authMethodOid: d.authMethod.oid,
          deploymentOid: d.providerDeployment?.oid,
          authCredentialsOid: d.credentials?.oid
        },
        include: providerAuthConfigInclude
      });

      let currentVersion = await db.providerAuthConfigVersion.create({
        data: {
          ...getId('providerAuthConfigVersion'),
          authConfigOid: providerAuthConfig.oid,
          slateAuthConfigOid: d.backendProviderAuthConfig.slateAuthConfig?.oid,
          shuttleAuthConfigOid: d.backendProviderAuthConfig.shuttleAuthConfig?.oid
        }
      });

      await db.providerAuthConfig.update({
        where: { oid: providerAuthConfig.oid },
        data: { currentVersionOid: currentVersion.oid }
      });

      let update = await db.providerAuthConfigUpdate.create({
        data: {
          ...getId('providerAuthConfigUpdate'),
          authConfigOid: providerAuthConfig.oid,
          toVersionOid: currentVersion.oid
        }
      });

      let authImport: ProviderAuthImport | undefined;

      if (
        d.import &&
        providerAuthConfig.source === 'manual' &&
        providerAuthConfig.type !== 'oauth_automated'
      ) {
        authImport = await db.providerAuthImport.create({
          data: {
            ...getId('providerAuthImport'),

            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid,
            authConfigOid: providerAuthConfig.oid,
            authConfigUpdateOid: update.oid,
            deploymentOid: d.providerDeployment?.oid,

            ip: d.import.ip,
            ua: d.import.ua,
            note: d.import.note,
            metadata: d.input.metadata,

            expiresAt: d.backendProviderAuthConfig.expiresAt
          }
        });
      }

      if (providerAuthConfig.isDefault && d.providerDeployment) {
        if (d.providerDeployment.defaultAuthConfigOid) {
          await db.providerAuthConfig.updateMany({
            where: {
              deploymentOid: d.providerDeployment.oid,
              isDefault: true
            },
            data: { isDefault: false }
          });
        }

        await db.providerDeployment.update({
          where: { oid: d.providerDeployment.oid },
          data: { defaultAuthConfigOid: providerAuthConfig.oid }
        });
      }

      await addAfterTransactionHook(async () =>
        providerAuthConfigCreatedQueue.add({ providerAuthConfigId: providerAuthConfig.id })
      );

      return {
        ...providerAuthConfig,
        authImport,
        currentVersion
      };
    });
  }

  async createBackendProviderAuthConfig(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    provider: Provider & { defaultVariant: ProviderVariant | null };
    providerVersion: ProviderVersion;
    authMethod: ProviderAuthMethod;

    config: Record<string, any>;
  }) {
    let backend = await getBackend({
      entity: d.provider.defaultVariant!
    });

    let backendProviderAuthConfig = await backend.auth.createProviderAuthConfig({
      tenant: d.tenant,
      provider: d.provider,
      providerVersion: d.providerVersion,
      authMethod: d.authMethod,
      input: d.config
    });

    return {
      backend: backend.backend,
      backendProviderAuthConfig
    };
  }
}

export let providerAuthConfigInternalService = Service.create(
  'providerAuthConfigInternal',
  () => new providerAuthConfigInternalServiceImpl()
).build();
