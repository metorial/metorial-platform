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
  type Solution,
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
import { checkTenant } from '@metorial-subspace/module-tenant';
import type { ProviderVariantEnrichment } from '@metorial-subspace/provider-utils';
import { prepareVersion } from '../internal/createVersion';
import { linkRepo } from '../internal/linkRepo';
import { getTenantForOrigin, origin } from '../origin';
import { customProviderUpdatedQueue } from '../queues/lifecycle/customProvider';
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

  async listCustomProviders(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    search?: string;

    status?: CustomProviderStatus[];
    type?: CustomProviderType[];
    allowDeleted?: boolean;

    createdAt?: DateFilter;
    updatedAt?: DateFilter;

    ids?: string[];
    providerIds?: string[];
    scmRepositoryIds?: string[];
  }) {
    let providers = await resolveProviders(d, d.providerIds);
    let scmRepos = await resolveScmRepos(d, d.scmRepositoryIds);

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
            solutionOid: d.solution.oid,

            ...normalizeStatusForList(d).noParent,

            AND: [
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

  async getCustomProviderById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    customProviderId: string;
    allowDeleted?: boolean;
  }) {
    let customProvider = await db.customProvider.findFirst({
      where: {
        id: d.customProviderId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include
    });
    if (!customProvider)
      throw new ServiceError(notFoundError('custom_provider', d.customProviderId));

    let [enriched] = await this.enrichCustomProviders({ customProviders: [customProvider] });
    return enriched!;
  }

  async createCustomProvider(d: {
    actor: TenantActor;
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    input: {
      name: string;
      description?: string;
      metadata?: Record<string, any>;

      from: CustomProviderFrom;
      config?: CustomProviderConfig;
    };
  }) {
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

    let customProvider = await withTransaction(async db => {
      let repo =
        d.input.from.type === 'function' && d.input.from.repository
          ? await linkRepo({
              tenant: d.tenant,
              solution: d.solution,
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
          solutionOid: d.solution.oid
        },
        include
      });

      let versionPrep = await prepareVersion({
        actor: d.actor,
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        customProvider,
        trigger: 'manual',
        payload: customProvider.payload
      });

      let upcoming = await db.upcomingCustomProvider.create({
        data: {
          ...getId('upcomingCustomProvider'),
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid,
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

  async updateCustomProvider(d: {
    tenant: Tenant;
    solution: Solution;
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
  }) {
    checkTenant(d, d.customProvider);
    checkDeletedEdit(d.customProvider, 'update');

    if (d.input.repository && d.customProvider.type !== 'function') {
      throw new ServiceError(
        badRequestError({
          message: `Cannot link SCM repository to custom provider of type ${d.customProvider.type}`
        })
      );
    }

    let customProvider = await withTransaction(async db => {
      let repo = d.input.repository
        ? await linkRepo({
            tenant: d.tenant,
            solution: d.solution,
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
            solutionOid: d.solution.oid,

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
          solutionOid: d.solution.oid
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
}

export let customProviderService = Service.create(
  'customProvider',
  () => new customProviderServiceImpl()
).build();
