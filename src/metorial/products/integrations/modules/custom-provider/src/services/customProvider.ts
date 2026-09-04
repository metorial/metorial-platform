import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  CustomProviderConfig,
  CustomProviderFrom,
  Provider,
  ProviderVariant
} from '@metorial-subspace/db';
import {
  addAfterTransactionHook,
  type CustomProvider,
  type CustomProviderStatus,
  type CustomProviderType,
  db,
  type Environment,
  getId,
  snowflake,
  type Tenant,
  type TenantActor,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveProviders,
  resolveScmRepos
} from '@metorial-subspace/list-utils';
import { providerInternalService } from '@metorial-subspace/module-provider-internal';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  type MetorialFacingWithActor,
  resolveMetorialFacing,
  resolveMetorialFacingWithActor,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { Fabric, type AuditSubspaceCustomProvider } from '@metorial/fabric';
import type { ProviderVariantEnrichment } from '@metorial-subspace/provider-utils';
import { prepareVersion } from '../internal/createVersion';
import { linkRepo } from '../internal/linkRepo';
import { getTenantForOrigin, origin } from '../origin';
import {
  customProviderArchivedQueue,
  customProviderUpdatedQueue
} from '../queues/lifecycle/customProvider';
import { handleUpcomingCustomProviderQueue } from '../queues/upcoming/handle';

let include = {
  provider: {
    include: {
      entry: true,
      publisher: true,
      ownerTenant: true,
      type: true,

      defaultVariant: {
        include: {
          provider: true,
          currentVersion: {
            include: {
              specification: {
                omit: { value: true }
              }
            }
          }
        }
      }
    }
  },
  scmRepo: true,
  draftCodeBucket: { include: { scmRepo: true } }
};

let customProviderEnvironmentVisibilityFilter = (environment: Environment) => ({
  customProviderEnvironments: {
    some: {
      environmentOid: environment.oid,
      OR: [
        {
          providerEnvironment: {
            is: {
              currentVersionOid: { not: null }
            }
          }
        },
        {
          customProviderEnvironmentVersions: {
            some: {}
          }
        }
      ]
    }
  }
});

export type CreateCustomProviderParams = {
  actor: TenantActor;
  tenant: Tenant;
  environment: Environment;

  input: {
    name: string;
    description?: string;
    metadata?: Record<string, any>;

    from: CustomProviderFrom;
    config?: CustomProviderConfig;
  };
};

export type UpdateCustomProviderParams = {
  tenant: Tenant;
  environment: Environment;
  actor: TenantActor;
  customProvider: CustomProvider;
  input: {
    name?: string;
    readme?: string;
    description?: string;
    metadata?: Record<string, any>;
    access?: 'public' | 'tenant';

    repository?:
      | {
          repositoryId: string;
          branch: string;
        }
      | {
          type: 'git';
          repositoryUrl: string;
          branch: string;
        }
      | null;
  };
};

export type UpdateCustomProviderFacingParams = Omit<
  UpdateCustomProviderParams,
  'customProvider'
> & {
  customProvider: UpdateCustomProviderParams['customProvider'] & AuditSubspaceCustomProvider;
};

export type ArchiveCustomProviderParams = {
  tenant: Tenant;
  environment: Environment;
  actor: TenantActor;
  customProvider: CustomProvider;
};

type ListCustomProvidersParams = {
  search?: string;

  status?: CustomProviderStatus[];
  type?: CustomProviderType[];
  allowDeleted?: boolean;

  createdAt?: DateFilter;
  updatedAt?: DateFilter;

  ids?: string[];
  providerIds?: string[];
  scmRepositoryIds?: string[];
};

type GetCustomProviderByIdParams = {
  customProviderId: string;
  allowDeleted?: boolean;
};

class customProviderServiceImpl {
  async enrichCustomProviders<
    T extends CustomProvider & {
      provider: (Provider & { defaultVariant: ProviderVariant | null }) | null;
    }
  >(d: { customProviders: T[] }) {
    let enriched = await providerInternalService.enrichProviders({
      providers: d.customProviders.map(p => p.provider!).filter(Boolean)
    });
    let enrichedMap = new Map<string, Provider & Partial<ProviderVariantEnrichment>>(
      enriched.map((p: Provider & Partial<ProviderVariantEnrichment>) => [p.id, p])
    );

    return d.customProviders.map(customProvider => {
      if (!customProvider.provider) return customProvider;
      let enrichment = enrichedMap.get(customProvider.provider.id);

      return {
        containerRegistry: enrichment?.containerRegistry,
        containerRepository: enrichment?.containerRepository,
        containerTag: enrichment?.containerTag,

        remoteUrl: enrichment?.remoteUrl,
        remoteProtocol: enrichment?.remoteProtocol,

        ...customProvider
      };
    });
  }

  async listCustomProviders(d: MetorialFacing<ListCustomProvidersParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listCustomProvidersInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listCustomProvidersInternal(
    d: { tenant: Tenant; environment: Environment } & ListCustomProvidersParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let providers = await resolveProviders(ts, d.providerIds);
    let scmRepos = await resolveScmRepos(ts, d.scmRepositoryIds);

    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.customProvider.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let res = await db.customProvider.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: solution.oid,

            ...normalizeStatusForList(d).noParent,

            AND: [
              customProviderEnvironmentVisibilityFilter(d.environment),
              d.type ? { type: { in: d.type } } : undefined!,
              d.ids ? { id: { in: d.ids } } : undefined!,
              search ? { id: { in: search.map(r => r.documentId) } } : undefined!,
              providers ? { providerOid: providers.in } : undefined!,
              scmRepos ? { scmRepoOid: scmRepos.in } : undefined!,
              d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
              d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
            ].filter(Boolean)
          },
          include
        });

        return this.enrichCustomProviders({ customProviders: res });
      })
    );
  }

  async getCustomProviderById(d: MetorialFacing<GetCustomProviderByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getCustomProviderByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getCustomProviderByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetCustomProviderByIdParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let customProvider = await db.customProvider.findFirst({
      where: {
        OR: [
          { id: d.customProviderId },
          { provider: { id: d.customProviderId } },
          { provider: { slug: d.customProviderId } }
        ],
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        ...normalizeStatusForGet(d).noParent,
        AND: [customProviderEnvironmentVisibilityFilter(d.environment)]
      },
      include
    });
    if (!customProvider)
      throw new ServiceError(notFoundError('custom_provider', d.customProviderId));

    let [enriched] = await this.enrichCustomProviders({ customProviders: [customProvider] });
    return enriched!;
  }

  async createCustomProvider(d: MetorialFacingWithActor<CreateCustomProviderParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacingWithActor(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.custom_provider.created:before', eventBase);

    let customProvider = await this.createCustomProviderInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment,
      actor: scope.actor
    });

    await Fabric.fire('provider.custom_provider.created:after', {
      ...eventBase,
      customProvider
    });

    return customProvider;
  }

  async updateCustomProvider(d: MetorialFacingWithActor<UpdateCustomProviderFacingParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacingWithActor(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.custom_provider.updated:before', eventBase);

    let customProvider = await this.updateCustomProviderInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment,
      actor: scope.actor
    });

    await Fabric.fire('provider.custom_provider.updated:after', {
      ...eventBase,
      previousCustomProvider: d.customProvider,
      customProvider
    });

    return customProvider;
  }

  async archiveCustomProvider(d: MetorialFacingWithActor<ArchiveCustomProviderParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacingWithActor(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.custom_provider.archived:before', eventBase);

    let customProvider = await this.archiveCustomProviderInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment,
      actor: scope.actor
    });

    await Fabric.fire('provider.custom_provider.archived:after', {
      ...eventBase,
      customProvider
    });

    return customProvider;
  }

  async createCustomProviderInternal(d: CreateCustomProviderParams) {
    if (
      d.input.from.type === 'function' &&
      !d.input.from.repository &&
      !d.input.from.files?.length
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Custom provider of type function requires a repository or files',
          hint: 'Please provide either a repository or deployment files for the custom provider.'
        })
      );
    }

    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    let customProvider = await withTransaction(async db => {
      let repo =
        d.input.from.type === 'function' && d.input.from.repository
          ? await linkRepo({
              tenant: d.tenant,
              solution,
              actor: d.actor,
              repo: d.input.from.repository
            })
          : undefined;

      let customProvider = await db.customProvider.create({
        data: {
          ...getId('customProvider'),

          type: d.input.from.type,
          status: 'active',

          maxVersionIndex: 0,

          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,

          scmRepoOid: repo?.repo.oid,
          draftCodeBucketOid: repo?.syncedCodeBucket.oid,

          payload: {
            from:
              d.input.from.type === 'function'
                ? { ...d.input.from, files: undefined }
                : d.input.from,
            config: d.input.config!
          },

          tenantOid: d.tenant.oid,
          projectOid: d.tenant.projectOid,
          solutionOid: solution.oid
        },
        include
      });

      let versionPrep = await prepareVersion({
        actor: d.actor,
        tenant: d.tenant,
        solution,
        environment: d.environment,
        customProvider,
        trigger: 'manual',
        payload: customProvider.payload
      });

      let upcoming = await db.upcomingCustomProvider.create({
        data: {
          ...getId('upcomingCustomProvider'),
          tenantOid: d.tenant.oid,
          projectOid: d.tenant.projectOid,
          solutionOid: solution.oid,
          environmentOid: d.environment.oid,
          instanceOid: d.environment.instanceOid,
          actorOid: d.actor.oid,

          message: 'Initial commit',

          type: 'create_custom_provider',

          customProviderOid: customProvider.oid,
          customProviderDeploymentOid: versionPrep.deployment.oid,
          customProviderVersionOid: versionPrep.version.oid,

          payload: {
            from: d.input.from,
            config: d.input.config
          }
        }
      });

      await addAfterTransactionHook(async () =>
        handleUpcomingCustomProviderQueue.add({ upcomingCustomProviderId: upcoming.id })
      );

      return customProvider;
    });

    let [enriched] = await this.enrichCustomProviders({ customProviders: [customProvider] });
    return enriched!;
  }

  async updateCustomProviderInternal(d: UpdateCustomProviderParams) {
    checkTenant(d, d.customProvider);
    checkDeletedEdit(d.customProvider, 'update');

    if (d.input.repository && d.customProvider.type !== 'function') {
      throw new ServiceError(
        badRequestError({
          message: `Cannot link SCM repository to custom provider of type ${d.customProvider.type}`
        })
      );
    }

    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    let customProvider = await withTransaction(async db => {
      let repo = d.input.repository
        ? await linkRepo({
            tenant: d.tenant,
            solution,
            actor: d.actor,
            repo: d.input.repository
          })
        : undefined;

      let draftCodeBucket = repo?.syncedCodeBucket;
      if (d.input.repository === null && d.customProvider.draftCodeBucketOid) {
        // If the repo link is removed we need to retain the current code
        // but in a new code bucket that has write access

        let tenant = await getTenantForOrigin(d.tenant);

        let record = await db.codeBucket.findUniqueOrThrow({
          where: { oid: d.customProvider.draftCodeBucketOid }
        });

        let originClone = await origin.codeBucket.clone({
          tenantId: tenant.id,
          codeBucketId: record.id
        });

        draftCodeBucket = await db.codeBucket.create({
          data: {
            oid: snowflake.nextId(),
            id: originClone.id,

            tenantOid: d.tenant.oid,
            projectOid: d.tenant.projectOid,
            solutionOid: solution.oid,

            isReadOnly: false,
            isImmutable: false,
            isSynced: false
          }
        });
      }

      let customProvider = await db.customProvider.update({
        where: {
          oid: d.customProvider.oid,
          tenantOid: d.tenant.oid,
          solutionOid: solution.oid
        },
        data: {
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,

          scmRepoOid: d.input.repository === null ? null : repo?.repo.oid,
          draftCodeBucketOid: draftCodeBucket?.oid
        },
        include: { provider: true }
      });

      if (customProvider.provider) {
        await providerInternalService.updateProvider({
          provider: customProvider.provider,
          input: {
            name: customProvider.name,
            readme: d.input.readme,
            description: customProvider.description ?? undefined,
            access: d.input.access
          }
        });
      }

      await addAfterTransactionHook(async () =>
        customProviderUpdatedQueue.add({ customProviderId: customProvider.id })
      );

      return await db.customProvider.findUniqueOrThrow({
        where: { oid: customProvider.oid },
        include
      });
    });

    let [enriched] = await this.enrichCustomProviders({ customProviders: [customProvider] });
    return enriched!;
  }

  async archiveCustomProviderInternal(d: ArchiveCustomProviderParams) {
    checkTenant(d, d.customProvider);
    checkDeletedEdit(d.customProvider, 'archive');

    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    let customProvider = await withTransaction(async db => {
      let customProvider = await db.customProvider.update({
        where: {
          oid: d.customProvider.oid,
          tenantOid: d.tenant.oid,
          solutionOid: solution.oid
        },
        data: { status: 'archived' },
        include
      });

      await db.upcomingCustomProvider.deleteMany({
        where: { customProviderOid: customProvider.oid }
      });

      await addAfterTransactionHook(async () =>
        customProviderArchivedQueue.add({ customProviderId: customProvider.id })
      );

      return customProvider;
    });

    let [enriched] = await this.enrichCustomProviders({ customProviders: [customProvider] });
    return enriched!;
  }
}

export let customProviderService = Service.create(
  'customProvider',
  () => new customProviderServiceImpl()
).build();
