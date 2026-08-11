import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  CustomProviderConfig,
  CustomProviderFromUpdate,
  CustomProviderVersion,
  ProviderVersion
} from '@metorial-subspace/db';
import {
  addAfterTransactionHook,
  db,
  getId,
  withTransaction,
  type CustomProvider,
  type CustomProviderVersionStatus,
  type Environment,
  type Tenant,
  type TenantActor
} from '@metorial-subspace/db';
import {
  checkDeletedRelation,
  normalizeDateFilter,
  resolveCustomProviderDeployments,
  resolveCustomProviderEnvironments,
  resolveCustomProviders,
  resolveProviders,
  resolveProviderVersions,
  type DateFilter
} from '@metorial-subspace/list-utils';
import { providerVersionInternalService } from '@metorial-subspace/module-provider-internal';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacingWithActor,
  resolveMetorialFacingWithActor,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { Fabric } from '@metorial/fabric';
import type { ProviderVersionEnrichment } from '@metorial-subspace/provider-utils';
import { prepareVersion } from '../internal/createVersion';
import {
  resolveCustomProviderConfig,
  resolveCustomProviderFromForDeployment
} from '../internal/resolveFrom';
import { handleUpcomingCustomProviderQueue } from '../queues/upcoming/handle';

let include = {
  customProvider: {
    include: {
      provider: true
    }
  },
  deployment: {
    include: {
      commit: true,
      scmRepoPush: { include: { repo: true } }
    }
  },
  providerVersion: true,
  immutableCodeBucket: { include: { scmRepo: true } },
  customProviderEnvironmentVersions: {
    include: {
      customProviderEnvironment: {
        include: {
          environment: true,
          providerEnvironment: {
            include: {
              currentVersion: true
            }
          }
        }
      }
    }
  },
  creatorActor: true
};

export type CreateCustomProviderVersionParams = {
  actor: TenantActor;
  tenant: Tenant;
  environment: Environment;

  customProvider: CustomProvider;
  input: {
    message?: string;
    from?: CustomProviderFromUpdate;
    config?: CustomProviderConfig;
  };
};

class customProviderVersionServiceImpl {
  async enrichCustomProviders<
    T extends CustomProviderVersion & {
      providerVersion: ProviderVersion | null;
    }
  >(d: { customProviders: T[] }) {
    let enriched = await providerVersionInternalService.enrichProviderVersions({
      providers: d.customProviders.map(p => p.providerVersion!).filter(Boolean)
    });
    let enrichedMap = new Map<string, ProviderVersion & Partial<ProviderVersionEnrichment>>(
      enriched.map((p: ProviderVersion & Partial<ProviderVersionEnrichment>) => [p.id, p])
    );

    return d.customProviders.map(customProvider => {
      if (!customProvider.providerVersion) return customProvider;
      let enrichment = enrichedMap.get(customProvider.providerVersion.id);

      return {
        containerRegistry: enrichment?.containerRegistry,
        containerRepository: enrichment?.containerRepository,
        containerVersion: enrichment?.containerVersion,
        containerTag: enrichment?.containerTag,

        remoteUrl: enrichment?.remoteUrl,
        remoteProtocol: enrichment?.remoteProtocol,

        ...customProvider
      };
    });
  }

  async createCustomProviderVersion(
    d: MetorialFacingWithActor<CreateCustomProviderVersionParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacingWithActor(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.custom_provider.version.created:before', eventBase);

    let customProviderVersion = await this.createCustomProviderVersionInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment,
      actor: scope.actor
    });

    await Fabric.fire('provider.custom_provider.version.created:after', {
      ...eventBase,
      customProviderVersion
    });

    return customProviderVersion;
  }

  async createCustomProviderVersionInternal(d: CreateCustomProviderVersionParams) {
    checkTenant(d, d.customProvider);
    checkDeletedRelation(d.customProvider);

    let resolvedFrom = resolveCustomProviderFromForDeployment({
      partial: d.input.from,
      provider: d.customProvider
    });
    let resolvedConfig = resolveCustomProviderConfig(
      d.input.config,
      d.customProvider.payload.config
    );

    if (d.customProvider.type !== resolvedFrom.type) {
      throw new ServiceError(
        badRequestError({
          message: `Custom provider type '${d.customProvider.type}' does not match deployment from type '${resolvedFrom.type}'`,
          hint: 'Please ensure the deployment from type matches the custom provider type.'
        })
      );
    }

    if (
      resolvedFrom.type === 'function' &&
      resolvedFrom.files?.length &&
      (resolvedFrom.repository || d.customProvider.scmRepoOid)
    ) {
      throw new ServiceError(
        badRequestError({
          message:
            'Cannot create deployment from files when SCM repo is set on custom provider',
          hint: 'Unlink the SCM repo from the custom provider or remove the files from the deployment input.'
        })
      );
    }

    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    let customProvider = await withTransaction(async db => {
      let updatedProvider = await db.customProvider.update({
        where: { oid: d.customProvider.oid },
        data: {
          payload: {
            from:
              resolvedFrom.type === 'function'
                ? { ...resolvedFrom, files: undefined }
                : resolvedFrom,
            config: resolvedConfig
          }
        }
      });

      let versionPrep = await prepareVersion({
        actor: d.actor,
        tenant: d.tenant,
        solution,
        environment: d.environment,
        customProvider: d.customProvider,
        trigger: 'manual',
        payload: updatedProvider.payload
      });

      let upcoming = await db.upcomingCustomProvider.create({
        data: {
          ...getId('upcomingCustomProvider'),
          tenantOid: d.tenant.oid,
          solutionOid: solution.oid,
          environmentOid: d.environment.oid,
          actorOid: d.actor.oid,

          message: d.input.message,

          type: 'create_custom_provider_version',

          customProviderOid: d.customProvider.oid,
          customProviderVersionOid: versionPrep.version.oid,
          customProviderDeploymentOid: versionPrep.deployment.oid,

          payload: {
            ...(d.input.from !== undefined ? { from: d.input.from } : {}),
            ...(d.input.config !== undefined ? { config: d.input.config } : {})
          } satisfies PrismaJson.UpcomingCustomProviderPayload
        }
      });

      await addAfterTransactionHook(async () =>
        handleUpcomingCustomProviderQueue.add({ upcomingCustomProviderId: upcoming.id })
      );

      return await db.customProviderVersion.findUniqueOrThrow({
        where: { oid: versionPrep.version.oid, tenantOid: d.tenant.oid },
        include
      });
    });

    let [enriched] = await this.enrichCustomProviders({ customProviders: [customProvider] });
    return enriched!;
  }

  async listCustomProviderVersions(d: {
    tenant: Tenant;
    environment: Environment;

    status?: CustomProviderVersionStatus[];

    createdAt?: DateFilter;
    updatedAt?: DateFilter;

    ids?: string[];
    providerIds?: string[];
    providerVersionIds?: string[];
    customProviderIds?: string[];
    customProviderDeploymentIds?: string[];
    customProviderEnvironmentIds?: string[];
  }) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let providers = await resolveProviders(ts, d.providerIds);
    let providerVersions = await resolveProviderVersions(ts, d.providerVersionIds);
    let customProviders = await resolveCustomProviders(ts, d.customProviderIds);
    let customProviderDeployments = await resolveCustomProviderDeployments(
      ts,
      d.customProviderDeploymentIds
    );
    let customProviderEnvironments = await resolveCustomProviderEnvironments(
      ts,
      d.customProviderEnvironmentIds
    );

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let res = await db.customProviderVersion.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: solution.oid,

            AND: [
              d.ids ? { id: { in: d.ids } } : undefined!,

              d.status ? { status: { in: d.status } } : undefined!,

              providers ? { customProvider: { providerOid: providers.in } } : undefined!,
              providerVersions ? { providerVersionOid: providerVersions.in } : undefined!,

              customProviders ? { customProviderOid: customProviders.in } : undefined!,
              customProviderDeployments
                ? { deploymentOid: customProviderDeployments.in }
                : undefined!,
              customProviderEnvironments
                ? {
                    customProviderEnvironmentVersions: {
                      some: { customProviderEnvironmentOid: customProviderEnvironments.in }
                    }
                  }
                : undefined!,
              d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
              d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
            ].filter(Boolean)
          },
          include
        });

        return await this.enrichCustomProviders({ customProviders: res });
      })
    );
  }

  async getCustomProviderVersionById(d: {
    tenant: Tenant;
    environment: Environment;
    customProviderVersionId: string;
  }) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let customProviderVersion = await db.customProviderVersion.findFirst({
      where: {
        id: d.customProviderVersionId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid
      },
      include
    });
    if (!customProviderVersion)
      throw new ServiceError(
        notFoundError('custom_provider.version', d.customProviderVersionId)
      );

    let [enriched] = await this.enrichCustomProviders({
      customProviders: [customProviderVersion]
    });
    return enriched!;
  }
}

export let customProviderVersionService = Service.create(
  'customProviderVersion',
  () => new customProviderVersionServiceImpl()
).build();
