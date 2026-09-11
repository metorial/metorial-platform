import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  getId,
  type ProviderAuthConfig,
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
  resolveProviders
} from '@metorial-subspace/list-utils';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing,
  resolveMetorialFacingWithOptionalActor,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { Fabric } from '@metorial/fabric';
import { getBackend } from '@metorial-subspace/provider';
import { checkManagedCredentialsBlocked } from '../lib/checkManagedCredentialsBlocked';
import { providerAuthConfigInclude } from './providerAuthConfig';

let include = {
  authConfig: {
    include: providerAuthConfigInclude
  }
};

export type CreateProviderAuthExportParams = {
  tenant: Tenant;
  environment: Environment;
  authConfig: ProviderAuthConfig;

  input: {
    ip: string | undefined;
    ua: string | undefined;
    note?: string | undefined;
    metadata?: Record<string, any>;
  };
};

type ListProviderAuthExportsParams = {
  allowDeleted?: boolean;

  ids?: string[];
  providerIds?: string[];
  providerAuthCredentialsIds?: string[];
  providerAuthConfigIds?: string[];

  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

type GetProviderAuthExportByIdParams = {
  providerAuthExportId: string;
  allowDeleted?: boolean;
};

class providerAuthExportServiceImpl {
  async listProviderAuthExports(d: MetorialFacing<ListProviderAuthExportsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listProviderAuthExportsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listProviderAuthExportsInternal(
    d: { tenant: Tenant; environment: Environment } & ListProviderAuthExportsParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let providers = await resolveProviders(ts, d.providerIds);
    let authConfigs = await resolveProviderAuthConfigs(ts, d.providerAuthConfigIds);
    let authCredentials = await resolveProviderAuthCredentials(
      ts,
      d.providerAuthCredentialsIds
    );

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerAuthExport.findMany({
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
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getProviderAuthExportById(d: MetorialFacing<GetProviderAuthExportByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getProviderAuthExportByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getProviderAuthExportByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetProviderAuthExportByIdParams
  ) {
    let solution = await getMetorialSolution();

    let providerAuthExport = await db.providerAuthExport.findFirst({
      where: {
        id: d.providerAuthExportId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).onlyParent
      },
      include
    });
    if (!providerAuthExport)
      throw new ServiceError(notFoundError('provider.auth_export', d.providerAuthExportId));

    return providerAuthExport;
  }

  async createProviderAuthExport(d: MetorialFacing<CreateProviderAuthExportParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacingWithOptionalActor(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.auth_export.created:before', eventBase);

    let result = await this.createProviderAuthExportInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.auth_export.created:after', {
      ...eventBase,
      authExport: result.authExport
    });

    return result;
  }

  async createProviderAuthExportInternal(d: CreateProviderAuthExportParams) {
    let solution = await getMetorialSolution();

    checkTenant(d, d.authConfig);
    checkDeletedRelation(d.authConfig);
    await checkManagedCredentialsBlocked(d.authConfig);

    if (!d.tenant.allowAuthConfigExport) {
      throw new ServiceError(
        forbiddenError({
          message: 'Auth config export is not enabled for this project'
        })
      );
    }

    let backend = await getBackend({ entity: d.authConfig });

    let newId = getId('providerAuthExport');

    if (!d.authConfig.currentVersionOid) throw new Error('Auth config has no current version');
    let currentVersion = await db.providerAuthConfigVersion.findUniqueOrThrow({
      where: { oid: d.authConfig.currentVersionOid }
    });

    let data = await backend.auth.getDecryptedAuthConfig({
      tenant: d.tenant,
      authConfig: d.authConfig,
      authConfigVersion: currentVersion,
      note: `SUBSPACE/export ${d.input.ip}`
    });

    let authExport = await db.providerAuthExport.create({
      data: {
        ...newId,

        ip: d.input.ip,
        ua: d.input.ua,
        note: d.input.note,
        metadata: d.input.metadata,

        tenantOid: d.tenant.oid,
        projectOid: d.tenant.projectOid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        instanceOid: d.environment.instanceOid,
        authConfigOid: d.authConfig.oid,

        expiresAt: data.expiresAt
      },
      include
    });

    return {
      authExport,
      decryptedConfigData: data.decryptedConfigData
    };
  }
}

export let providerAuthExportService = Service.create(
  'providerAuthExport',
  () => new providerAuthExportServiceImpl()
).build();
