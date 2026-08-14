import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  type Backend,
  db,
  type Environment,
  getId,
  type Prisma,
  type Provider,
  type ProviderAuthConfig,
  type ProviderAuthConfigSource,
  type ProviderAuthConfigType,
  type ProviderAuthConfigVersion,
  type ProviderAuthCredentials,
  type ProviderAuthImport,
  type ProviderAuthMethod,
  ProviderAuthMethodType,
  type ProviderDeployment,
  type ProviderDeploymentVersion,
  type ProviderVariant,
  type ProviderVersion,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkProviderMatch,
  providerDeploymentInternalService
} from '@metorial-subspace/module-provider-internal';
import { getMetorialSolution,
  checkTenant } from '@metorial-subspace/module-tenant';
import { getBackend } from '@metorial-subspace/provider';
import type { ProviderAuthConfigCreateRes } from '@metorial-subspace/provider-utils';
import { providerAuthConfigCreatedQueue } from '../queues/lifecycle/providerAuthConfig';
import { providerAuthConfigInclude } from './providerAuthConfig';

type ProviderAuthMethodWithSpecification = Prisma.ProviderAuthMethodGetPayload<{
  include: {
    specification: true;
  };
}>;

class providerAuthConfigInternalServiceImpl {
  async getVersionAndAuthMethod(d: {
    tenant: Tenant;
    environment: Environment;
    provider: Provider & { defaultVariant: ProviderVariant | null };
    providerDeployment?: ProviderDeployment & {
      currentVersion:
        | (ProviderDeploymentVersion & { lockedVersion: ProviderVersion | null })
        | null;
    };
    authMethodId?: string;
    credentials?: ProviderAuthCredentials;
  }): Promise<{
    version: ProviderVersion;
    authMethod: ProviderAuthMethodWithSpecification;
  }> {
    let version = await providerDeploymentInternalService.getCurrentVersionOptional({
      provider: d.provider,
      environment: d.environment,
      deployment: d.providerDeployment
    });
    let specificationOid = version?.specificationOid;
    if (specificationOid == null) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider has not been discovered'
        })
      );
    }

    let managedCredentials = d.credentials
      ? await this.getManagedProviderAuthCredentialsContext({
          tenant: d.tenant,
          providerAuthCredentials: d.credentials
        })
      : null;
    if (managedCredentials) {
      let authMethod = await this.getManagedAuthMethodForVersion({
        provider: d.provider,
        specificationOid,
        managedCredentials
      });

      if (d.authMethodId) {
        let requestedAuthMethod = await this.findAuthMethodForVersion({
          provider: d.provider,
          specificationOid,
          authMethodId: d.authMethodId
        });
        if (
          !requestedAuthMethod ||
          (requestedAuthMethod.oid !== authMethod.oid &&
            requestedAuthMethod.globalOid !== authMethod.globalOid &&
            requestedAuthMethod.callableId !== authMethod.callableId)
        ) {
          throw new ServiceError(
            badRequestError({
              message:
                'Managed credentials can only be used with their configured auth method',
              code: 'managed_credentials_auth_method_mismatch'
            })
          );
        }

        authMethod = requestedAuthMethod;
      }

      return {
        version: version as ProviderVersion,
        authMethod: authMethod as ProviderAuthMethodWithSpecification
      };
    }

    let authMethod = d.authMethodId
      ? await this.findAuthMethodForVersion({
          provider: d.provider,
          specificationOid,
          authMethodId: d.authMethodId
        })
      : d.credentials?.type === 'oauth'
        ? await this.findPreferredAuthMethodForVersion({
            provider: d.provider,
            specificationOid,
            type: 'oauth'
          })
        : await this.findPreferredAuthMethodForVersion({
            provider: d.provider,
            specificationOid,
            isDefault: true
          });

    if (!authMethod) {
      throw new ServiceError(
        badRequestError(
          d.authMethodId
            ? {
                message: 'Invalid auth method for provider',
                code: 'invalid_auth_method'
              }
            : {
                message: 'Provider does not support authentication'
              }
        )
      );
    }

    return {
      version: version as ProviderVersion,
      authMethod: authMethod as ProviderAuthMethodWithSpecification
    };
  }

  private async findAuthMethodForVersion(d: {
    provider: Provider;
    specificationOid: bigint;
    authMethodId: string;
  }) {
    let authMethodForSpec = await db.providerAuthMethod.findFirst({
      where: {
        providerOid: d.provider.oid,
        specificationOid: d.specificationOid,
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
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
    });
    if (authMethodForSpec) return authMethodForSpec;

    // This is likely because a version mismatch - an integration or other resource is
    // locked to a specific auth method id, but the spec has changed and that auth method
    // is not part of the new spec. We now need to find a fallback that matches the locked
    // auth method id, but is part of the new spec.
    let oldAuthMethod = await db.providerAuthMethod.findFirst({
      where: {
        providerOid: d.provider.oid,
        id: d.authMethodId
      }
    });

    // There is no such auth method in the old spec,
    // nothing we can do to resolve this
    if (!oldAuthMethod) return null;

    // Now we need to find an auth method in the new spec that matches the old auth method
    let fallbackAuthMethod = await db.providerAuthMethod.findFirst({
      where: {
        providerOid: d.provider.oid,
        specificationOid: d.specificationOid,
        globalOid: oldAuthMethod.globalOid
      },
      include: {
        specification: true
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
    });
    if (fallbackAuthMethod) return fallbackAuthMethod;

    // Now we need to find an auth method in the new spec that matches the old auth method
    fallbackAuthMethod = await db.providerAuthMethod.findFirst({
      where: {
        providerOid: d.provider.oid,
        specificationOid: d.specificationOid,
        OR: [
          { specId: oldAuthMethod.specId },
          { specUniqueIdentifier: oldAuthMethod.specUniqueIdentifier },
          { key: oldAuthMethod.key },
          { callableId: oldAuthMethod.callableId }
        ]
      },
      include: {
        specification: true
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
    });
    if (fallbackAuthMethod) return fallbackAuthMethod;

    fallbackAuthMethod = await db.providerAuthMethod.findFirst({
      where: {
        providerOid: d.provider.oid,
        specificationOid: d.specificationOid,
        type: oldAuthMethod.type
      },
      include: {
        specification: true
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
    });
    if (fallbackAuthMethod) return fallbackAuthMethod;

    return null;
  }

  private async findPreferredAuthMethodForVersion(d: {
    provider: Provider;
    specificationOid: bigint;
    isDefault?: boolean;
    type?: keyof typeof ProviderAuthMethodType;
  }) {
    return await db.providerAuthMethod.findFirst({
      where: {
        providerOid: d.provider.oid,
        specificationOid: d.specificationOid,
        isDefault: d.isDefault,
        type: d.type as any
      },
      include: {
        specification: true
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
    });
  }

  private async getManagedAuthMethodForVersion(d: {
    provider: Provider;
    specificationOid: bigint;
    managedCredentials: {
      initialProviderAuthMethodOid: bigint;
      providerAuthMethodGlobalOid: bigint | null;
    };
  }) {
    let authMethod: ProviderAuthMethodWithSpecification | null = null;
    let providerAuthMethodGlobalOid = d.managedCredentials.providerAuthMethodGlobalOid;

    if (providerAuthMethodGlobalOid !== null) {
      let result = await db.providerAuthMethod.findFirst({
        where: {
          providerOid: d.provider.oid,
          specificationOid: d.specificationOid,
          globalOid: providerAuthMethodGlobalOid
        },
        include: {
          specification: true
        }
      });
      authMethod = result as ProviderAuthMethodWithSpecification | null;
    } else {
      let result = await db.providerAuthMethod.findFirst({
        where: {
          oid: d.managedCredentials.initialProviderAuthMethodOid,
          providerOid: d.provider.oid,
          specificationOid: d.specificationOid
        },
        include: {
          specification: true
        }
      });
      authMethod = result as ProviderAuthMethodWithSpecification | null;
    }

    if (authMethod) return authMethod;

    throw new ServiceError(
      badRequestError({
        message: 'Managed credentials are not available for the resolved provider version',
        code: 'managed_credentials_auth_method_unavailable'
      })
    );
  }

  private async getManagedProviderAuthCredentialsContext(d: {
    tenant: Tenant;
    providerAuthCredentials: ProviderAuthCredentials;
  }) {
    let solution = await getMetorialSolution();
    if (
      d.providerAuthCredentials.origin === 'managed_public' &&
      d.providerAuthCredentials.managedCredentialsOid
    ) {
      return await db.managedProviderAuthCredentials.findFirst({
        where: {
          oid: d.providerAuthCredentials.managedCredentialsOid,
          solutionOid: solution.oid
        },
        select: {
          initialProviderAuthMethodOid: true,
          providerAuthMethodGlobalOid: true
        }
      });
    }

    if (d.providerAuthCredentials.origin !== 'managed_backing') {
      return null;
    }

    let backing = await db.managedProviderAuthCredentialsBacking.findFirst({
      where: {
        providerAuthCredentialsOid: d.providerAuthCredentials.oid,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid
      },
      select: {
        managedCredentials: {
          select: {
            initialProviderAuthMethodOid: true,
            providerAuthMethodGlobalOid: true
          }
        }
      }
    });

    return backing?.managedCredentials ?? null;
  }

  async createProviderAuthConfigInternal(d: {
    tenant: Tenant;
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
      privateMetadata?: Record<string, any>;
      isEphemeral?: boolean;
      isDefault?: boolean;
      toolFilters?: PrismaJson.ToolFilter | null;
    };
    import?: {
      ip: string | undefined;
      ua: string | undefined;
      note?: string | undefined;
    };

    authMethod: ProviderAuthMethod;
    backendProviderAuthConfig: ProviderAuthConfigCreateRes;
  }) {
    let solution = await getMetorialSolution();
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
          privateMetadata: d.input.privateMetadata,
          toolFilter: d.input.toolFilters ?? { type: 'v1.allow_all' },

          isEphemeral: !!d.input.isEphemeral,
          isDefault: !!d.input.isDefault,

          tenantOid: d.tenant.oid,
          projectOid: d.tenant.projectOid,
          solutionOid: solution.oid,
          environmentOid: d.environment.oid,
          instanceOid: d.environment.instanceOid,
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
            projectOid: d.tenant.projectOid,
            solutionOid: solution.oid,
            environmentOid: d.environment.oid,
            instanceOid: d.environment.instanceOid,
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

  async syncProviderAuthConfigScopes(d: {
    tenant: Tenant;
    providerAuthConfig: ProviderAuthConfig & {
      currentVersion?: ProviderAuthConfigVersion | null;
    };
  }) {
    return withTransaction(
      async db => {
        let currentVersion =
          d.providerAuthConfig.currentVersion ??
          (d.providerAuthConfig.currentVersionOid
            ? await db.providerAuthConfigVersion.findUnique({
                where: { oid: d.providerAuthConfig.currentVersionOid }
              })
            : null);

        let scopes: string[] | null = [];
        if (currentVersion) {
          let backend = await getBackend({
            entity: {
              backendOid: d.providerAuthConfig.backendOid
            }
          });

          let res = await backend.auth.getProviderAuthConfigScopes({
            tenant: d.tenant,
            authConfigVersion: currentVersion
          });
          scopes = res.scopes;
        }

        if (scopes === null) {
          return await db.providerAuthConfig.findUniqueOrThrow({
            where: { oid: d.providerAuthConfig.oid },
            include: providerAuthConfigInclude
          });
        }

        return await db.providerAuthConfig.update({
          where: { oid: d.providerAuthConfig.oid },
          data: {
            scopes,
            needsScopeSync: false
          },
          include: providerAuthConfigInclude
        });
      },
      { ifExists: true }
    );
  }

  async createBackendProviderAuthConfig(d: {
    tenant: Tenant;
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
