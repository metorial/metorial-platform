import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import { shadowId } from '@mtsrc/shadow-id';
import {
  type CustomProviderDeployment,
  type CustomProviderDeploymentStatus,
  db,
  type Environment,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveCustomProviderDeployments,
  resolveCustomProviderEnvironments,
  resolveCustomProviders,
  resolveProviderVersions,
  resolveCustomProviderVersions,
  resolveProviders
} from '@metorial-subspace/list-utils';
import { getTenantForShuttle, shuttle } from '@metorial-subspace/provider-shuttle/src/client';

let include = {
  customProvider: {
    include: {
      provider: true
    }
  },
  creatorActor: true,
  customProviderVersion: true,
  commit: true,
  scmRepoPush: { include: { repo: true } },
  immutableCodeBucket: { include: { scmRepo: true } }
};

class customProviderDeploymentServiceImpl {
  async listCustomProviderDeployments(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    status?: CustomProviderDeploymentStatus[];

    createdAt?: DateFilter;
    updatedAt?: DateFilter;

    ids?: string[];
    providerIds?: string[];
    providerVersionIds?: string[];
    customProviderIds?: string[];
    customProviderVersionIds?: string[];
    customProviderEnvironmentIds?: string[];
  }) {
    let providers = await resolveProviders(d, d.providerIds);
    let providerVersions = await resolveProviderVersions(d, d.providerVersionIds);
    let customProviders = await resolveCustomProviders(d, d.customProviderIds);
    let customProviderVersions = await resolveCustomProviderVersions(d, d.customProviderVersionIds);
    let customProviderEnvironments = await resolveCustomProviderEnvironments(
      d,
      d.customProviderEnvironmentIds
    );

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.customProviderDeployment.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,

                d.status ? { status: { in: d.status } } : undefined!,

                providers ? { customProvider: { providerOid: providers.in } } : undefined!,
                providerVersions
                  ? { customProviderVersion: { providerVersionOid: providerVersions.in } }
                  : undefined!,

                customProviders ? { customProviderOid: customProviders.in } : undefined!,
                customProviderVersions
                  ? { customProviderVersion: { oid: customProviderVersions.in } }
                  : undefined!,
                customProviderEnvironments
                  ? {
                      OR: [
                        {
                          sourceEnvironmentOid: customProviderEnvironments.in
                        },
                        {
                          customProviderVersion: {
                            customProviderEnvironmentVersions: {
                              some: {
                                customProviderEnvironmentOid: customProviderEnvironments.in
                              }
                            }
                          }
                        }
                      ]
                    }
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

  async getCustomProviderDeploymentById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    customProviderDeploymentId: string;
  }) {
    let customProviderDeployment = await db.customProviderDeployment.findFirst({
      where: {
        id: d.customProviderDeploymentId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid
      },
      include
    });
    if (!customProviderDeployment)
      throw new ServiceError(
        notFoundError('custom_provider.deployment', d.customProviderDeploymentId)
      );

    return customProviderDeployment;
  }

  async getLogs(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    customProviderDeployment: CustomProviderDeployment;
  }) {
    if (!d.customProviderDeployment.shuttleCustomServerDeploymentOid) {
      return {
        object: 'custom_provider.deployment.logs',
        customProviderDeploymentId: d.customProviderDeployment.id,
        steps: []
      };
    }

    let shuttleDeployment = await db.shuttleCustomServerDeployment.findFirstOrThrow({
      where: {
        oid: d.customProviderDeployment.shuttleCustomServerDeploymentOid
      }
    });

    let tenant = await getTenantForShuttle(d.tenant);

    let steps = await shuttle.serverDeployment.getOutput({
      tenantId: tenant.id,
      serverDeploymentId: shuttleDeployment.id
    });

    return {
      object: 'custom_provider.deployment.logs',
      customProviderDeploymentId: d.customProviderDeployment.id,
      steps: steps.map(l => ({
        ...l,
        id: shadowId('cpds_', [l.id]),
        object: 'custom_provider.deployment.step',

        logs: l.logs.map((log: any) => ({
          ...log,
          object: 'custom_provider.deployment.log'
        }))
      }))
    };
  }
}

export let customProviderDeploymentService = Service.create(
  'customProviderDeployment',
  () => new customProviderDeploymentServiceImpl()
).build();
