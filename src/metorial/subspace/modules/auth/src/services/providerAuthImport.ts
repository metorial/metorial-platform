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
import {
  getMetorialSolution,
  checkTenant,
  type MetorialFacing,
  type MetorialFacingWithOptionalConsumerActor,
  resolveMetorialFacing,
  resolveMetorialFacingWithOptionalActor,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { Fabric } from '@metorial/fabric';
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

type ListProviderAuthImportsParams = {
  allowDeleted?: boolean;

  ids?: string[];
  providerIds?: string[];
  providerAuthCredentialsIds?: string[];
  providerAuthConfigIds?: string[];
  providerDeploymentIds?: string[];

  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

type GetProviderAuthImportByIdParams = {
  providerAuthImportId: string;
  allowDeleted?: boolean;
};

class providerAuthImportServiceImpl {
  async listProviderAuthImports(d: MetorialFacing<ListProviderAuthImportsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listProviderAuthImportsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listProviderAuthImportsInternal(
    d: { tenant: Tenant; environment: Environment } & ListProviderAuthImportsParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let providers = await resolveProviders(ts, d.providerIds);
    let authConfigs = await resolveProviderAuthConfigs(ts, d.providerAuthConfigIds);
    let authCredentials = await resolveProviderAuthCredentials(
      ts,
      d.providerAuthCredentialsIds
    );
    let deployments = await resolveProviderDeployments(ts, d.providerDeploymentIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerAuthImport.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
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

  async getProviderAuthImportById(d: MetorialFacing<GetProviderAuthImportByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getProviderAuthImportByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getProviderAuthImportByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetProviderAuthImportByIdParams
  ) {
    let solution = await getMetorialSolution();
    let providerAuthImport = await db.providerAuthImport.findFirst({
      where: {
        id: d.providerAuthImportId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
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
    d: MetorialFacing<
      ProviderAuthImportParams & {
        input: { authMethodId?: string };
      }
    >
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getProviderAuthImportSchemaInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getProviderAuthImportSchemaInternal(
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
        environment: d.environment,
        provider: checkRes.provider,
        providerDeployment: checkRes.providerDeployment,
        authMethodId: d.input.authMethodId
      });

    return await providerAuthConfigService.getProviderAuthConfigSchemaInternal({
      tenant: d.tenant,
      environment: d.environment,

      provider: checkRes.provider,
      providerDeployment: checkRes.providerDeployment,
      providerVersion: version,
      authMethodId: authMethod.id
    });
  }

  async createProviderAuthImport(
    d: MetorialFacingWithOptionalConsumerActor<
      ProviderAuthImportParams & {
        input: {
          ip: string | undefined;
          ua: string | undefined;
          note?: string | undefined;
          metadata?: Record<string, any>;
          authMethodId?: string;
          config: Record<string, any>;
        };
      }
    >
  ) {
    let { instance, organizationActor, consumer, ...rest } = d;
    let scope = await resolveMetorialFacingWithOptionalActor(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.auth_import.created:before', eventBase);

    let authImport = await this.createProviderAuthImportInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.auth_import.created:after', { ...eventBase, authImport });

    return authImport;
  }

  async createProviderAuthImportInternal(
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
      
      let authConfigRes = await providerAuthConfigService.updateProviderAuthConfigInternal({
        tenant: d.tenant,
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
      let authConfigRes = await providerAuthConfigService.createProviderAuthConfigInternal({
        tenant: d.tenant,
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
