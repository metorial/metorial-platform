import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  getId,
  type ProviderAuthConfig,
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
  resolveProviders
} from '@metorial-subspace/list-utils';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { getBackend } from '@metorial-subspace/provider';
import { checkManagedCredentialsBlocked } from '../lib/checkManagedCredentialsBlocked';
import { providerAuthConfigInclude } from './providerAuthConfig';

let include = {
  authConfig: {
    include: providerAuthConfigInclude
  }
};

class providerAuthExportServiceImpl {
  async listProviderAuthExports(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    allowDeleted?: boolean;

    ids?: string[];
    providerIds?: string[];
    providerAuthCredentialsIds?: string[];
    providerAuthConfigIds?: string[];

    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let providers = await resolveProviders(d, d.providerIds);
    let authConfigs = await resolveProviderAuthConfigs(d, d.providerAuthConfigIds);
    let authCredentials = await resolveProviderAuthCredentials(
      d,
      d.providerAuthCredentialsIds
    );

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerAuthExport.findMany({
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
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getProviderAuthExportById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerAuthExportId: string;
    allowDeleted?: boolean;
  }) {
    let providerAuthExport = await db.providerAuthExport.findFirst({
      where: {
        id: d.providerAuthExportId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).onlyParent
      },
      include
    });
    if (!providerAuthExport)
      throw new ServiceError(notFoundError('provider.auth_export', d.providerAuthExportId));

    return providerAuthExport;
  }

  async createProviderAuthExport(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    authConfig: ProviderAuthConfig;

    input: {
      ip: string | undefined;
      ua: string | undefined;
      note?: string | undefined;
      metadata?: Record<string, any>;
    };
  }) {
    checkTenant(d, d.authConfig);
    checkDeletedRelation(d.authConfig);
    await checkManagedCredentialsBlocked(d.authConfig);

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
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
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
