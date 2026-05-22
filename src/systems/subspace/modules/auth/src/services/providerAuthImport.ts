import { notFoundError, ServiceError, badRequestError, forbiddenError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type Provider,
  type ProviderAuthConfig,
  type ProviderDeployment,
  type ProviderDeploymentVersion,
  type ProviderVariant,
  type ProviderVersion,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import {
  checkDeletedRelation,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveProviderAuthConfigs,
  resolveProviderAuthCredentials,
  resolveProviderDeployments,
  resolveProviders
} from '@metorial-subspace/list-utils';
import { checkProviderMatch } from '@metorial-subspace/module-provider-internal';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { checkManagedCredentialsBlocked } from '../lib/checkManagedCredentialsBlocked';
import { providerAuthConfigInclude, providerAuthConfigService } from './providerAuthConfig';
import { providerAuthConfigInternalService } from './providerAuthConfigInternal';

let include = {
  authConfig: {
    include: providerAuthConfigInclude
  }
};

export interface ProviderAuthImportParams {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;

  provider?: Provider & { defaultVariant: ProviderVariant | null };
  providerDeployment?: ProviderDeployment & {
    provider: Provider;
    providerVariant: ProviderVariant;
    currentVersion:
      | (ProviderDeploymentVersion & { lockedVersion: ProviderVersion | null })
      | null;
  };
  providerAuthConfig?: ProviderAuthConfig & { authMethod: { id: string } };
}

class providerAuthImportServiceImpl {
  async listProviderAuthImports(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    allowDeleted?: boolean;

    ids?: string[];
    providerIds?: string[];
    providerAuthCredentialsIds?: string[];
    providerAuthConfigIds?: string[];
    providerDeploymentIds?: string[];

    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let providers = await resolveProviders(d, d.providerIds);
    let authConfigs = await resolveProviderAuthConfigs(d, d.providerAuthConfigIds);
    let authCredentials = await resolveProviderAuthCredentials(
      d,
      d.providerAuthCredentialsIds
    );
    let deployments = await resolveProviderDeployments(d, d.providerDeploymentIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerAuthImport.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,

              ...normalizeStatusForList(d).onlyParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                providers ? { authConfig: { providerOid: providers.in } } : undefined!,
                authConfigs ? { authConfigOid: authConfigs.in } : undefined!,
                authCredentials
                  ? { authConfig: { authCredentialsOid: authCredentials.in } }
                  : undefined!,
                deployments ? { authConfig: { deploymentOid: deployments.in } } : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getProviderAuthImportById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerAuthImportId: string;
    allowDeleted?: boolean;
  }) {
    let providerAuthImport = await db.providerAuthImport.findFirst({
      where: {
        id: d.providerAuthImportId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).onlyParent
      },
      include
    });
    if (!providerAuthImport)
      throw new ServiceError(notFoundError('provider.auth_import', d.providerAuthImportId));

    return providerAuthImport;
  }

  async getProviderAuthImportSchema(
    d: ProviderAuthImportParams & {
      input: { authMethodId?: string };
    }
  ) {
    if (!d.tenant.allowAuthConfigImport) {
      throw new ServiceError(
        forbiddenError({
          message: 'Auth config import is not enabled for this project'
        })
      );
    }

    checkTenant(d, d.providerAuthConfig);
    checkTenant(d, d.providerDeployment);

    checkDeletedRelation(d.providerAuthConfig);
    checkDeletedRelation(d.providerDeployment);

    let checkRes = await this.check(d);

    checkProviderMatch(checkRes.provider, checkRes.providerAuthConfig);
    checkProviderMatch(checkRes.provider, checkRes.providerDeployment);

    let { authMethod, version } =
      await providerAuthConfigInternalService.getVersionAndAuthMethod({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        provider: checkRes.provider,
        providerDeployment: checkRes.providerDeployment,
        authMethodId: d.input.authMethodId
      });

    return await providerAuthConfigService.getProviderAuthConfigSchema({
      tenant: d.tenant,
      environment: d.environment,
      solution: d.solution,

      provider: checkRes.provider,
      providerDeployment: checkRes.providerDeployment,
      providerVersion: version,
      authMethodId: authMethod.id
    });
  }

  async createProviderAuthImport(
    d: ProviderAuthImportParams & {
      input: {
        ip: string | undefined;
        ua: string | undefined;
        note?: string | undefined;
        metadata?: Record<string, any>;

        authMethodId?: string;
        config: Record<string, any>;
      };
    }
  ) {
    if (!d.tenant.allowAuthConfigImport) {
      throw new ServiceError(
        forbiddenError({
          message: 'Auth config import is not enabled for this project'
        })
      );
    }

    let checkRes = await this.check(d);

    checkProviderMatch(checkRes.provider, checkRes.providerAuthConfig);
    checkProviderMatch(checkRes.provider, checkRes.providerDeployment);

    let importOid: bigint;

    if (checkRes.type === 'update_config') {
      await checkManagedCredentialsBlocked(checkRes.providerAuthConfig);
      
      let authConfigRes = await providerAuthConfigService.updateProviderAuthConfig({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        providerAuthConfig: checkRes.providerAuthConfig,

        import: {
          ip: d.input.ip,
          ua: d.input.ua,
          note: d.input.note
        },

        input: {
          authMethodId: d.input.authMethodId,
          config: d.input.config
        }
      });

      importOid = authConfigRes.authImport!.oid;
    } else {
      let authConfigRes = await providerAuthConfigService.createProviderAuthConfig({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,

        provider: checkRes.provider,
        providerDeployment: checkRes.providerDeployment,

        source: 'manual',

        import: {
          ip: d.input.ip,
          ua: d.input.ua,
          note: d.input.note
        },

        input: {
          authMethodId: d.input.authMethodId,
          name: `Imported Config ${new Date().toISOString()}`,
          config: d.input.config,
          metadata: d.input.metadata
        }
      });

      importOid = authConfigRes.authImport!.oid;
    }

    return db.providerAuthImport.findUniqueOrThrow({
      where: { oid: importOid },
      include
    });
  }

  private async check(d: ProviderAuthImportParams) {
    checkTenant(d, d.providerAuthConfig);
    checkTenant(d, d.providerDeployment);

    if (
      d.providerDeployment &&
      d.provider &&
      d.providerDeployment.providerOid !== d.provider.oid
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider deployment does not belong to provider',
          code: 'provider_mismatch'
        })
      );
    }
    if (
      d.providerAuthConfig?.deploymentOid &&
      d.providerDeployment &&
      d.providerAuthConfig.deploymentOid !== d.providerDeployment.oid
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider deployment does not match between import and config',
          code: 'provider_mismatch'
        })
      );
    }
    if (
      d.provider &&
      d.providerAuthConfig &&
      d.providerAuthConfig.providerOid !== d.provider.oid
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider mismatch between import and config',
          code: 'provider_mismatch'
        })
      );
    }

    if (d.providerAuthConfig) {
      let provider = await db.provider.findFirstOrThrow({
        where: { oid: d.providerAuthConfig.providerOid },
        include: { defaultVariant: true }
      });

      if (
        d.providerDeployment &&
        d.providerAuthConfig.deploymentOid !== d.providerDeployment.oid
      ) {
        throw new ServiceError(
          badRequestError({
            message: 'Provider deployment does not match between import and config',
            code: 'provider_mismatch'
          })
        );
      }

      return {
        type: 'update_config' as const,
        provider,
        providerAuthConfig: d.providerAuthConfig
      };
    }

    if (!d.provider) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider must be provided when no auth config is given',
          code: 'provider_required'
        })
      );
    }

    return {
      type: 'new_config' as const,
      provider: d.provider,
      providerDeployment: d.providerDeployment
    };
  }
}

export let providerAuthImportService = Service.create(
  'providerAuthImport',
  () => new providerAuthImportServiceImpl()
).build();
