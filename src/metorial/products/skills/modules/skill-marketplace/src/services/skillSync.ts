import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Instance, Prisma, Project, SkillDestinationSyncStatus } from '@metorial/db';
import { db, withTransaction } from '@metorial/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveSkillMarketplaces,
  resolveSkillPlugins
} from '@metorial/list-utils';
import { getOriginTenant, origin } from '@metorial/skills-scm-utils';
import { isRepositorySyncRetrying } from '../lib/repositorySyncStatus';

export let skillSyncInclude = {
  destination: {
    include: {
      skillMarketplace: {
        select: {
          id: true,
          projectOid: true
        }
      },
      skillPlugin: {
        select: {
          id: true,
          projectOid: true
        }
      }
    }
  },
  repositoryPropagations: {
    orderBy: {
      createdAt: 'asc'
    },
    include: {
      skillRepository: true
    }
  }
} satisfies Prisma.SkillDestinationSyncInclude;

export type SkillSyncRecord = Prisma.SkillDestinationSyncGetPayload<{
  include: typeof skillSyncInclude;
}>;

export type SkillSyncStatusFilter = SkillDestinationSyncStatus;

export type SkillSyncRepositoryCheck = {
  propagationId: string;
  repoId: string;
  provider: 'github' | 'gitlab' | 'bitbucket' | null;
  repositoryName: string;
  repositoryUrl: string | null;
  pullRequestUrl: string | null;
  repositoryAccessMode: 'pull_request' | 'default_branch';
  forceMergeOrPush: boolean;
  mergeBeforeChecksPass: boolean;
  overrideAttemptStatus: 'not_attempted' | 'attempting' | 'refused' | 'waiting' | 'succeeded';
  overrideRefusalReason: string | null;
  targetBranch: string | null;
  status: SkillSyncRecord['repositoryPropagations'][number]['status'];
  originStatus: string | null;
  blockers: string[];
  checks: {
    name: string;
    status: string;
    url: string | null;
    summary: string | null;
  }[];
  reviewStatus: string | null;
  requiredReviewCount: number | null;
  approvedReviewCount: number | null;
  mergeability: string | null;
  lastCheckedAt: Date | null;
  errorMessage: string | null;
};

class SkillSyncServiceImpl {
  private async getSkillSyncRecord(d: {
    project: Project;
    instance: Instance;
    skillSyncId: string;
  }) {
    return await withTransaction(
      async db => {
        let skillSync = await db.skillDestinationSync.findFirst({
          where: {
            id: d.skillSyncId,
            destination: this.scopeDestinationWhere(d)
          },
          include: skillSyncInclude
        });

        if (!skillSync) {
          throw new ServiceError(notFoundError('skill.sync', d.skillSyncId));
        }

        return skillSync;
      },
      { ifExists: true }
    );
  }

  private scopeDestinationWhere(d: {
    project: Project;
    instance: Instance;
  }): Prisma.SkillDestinationWhereInput {
    return {
      OR: [
        {
          skillMarketplace: {
            projectOid: d.project.oid,
            instanceOid: d.instance.oid
          }
        },
        {
          skillPlugin: {
            projectOid: d.project.oid,
            instanceOid: d.instance.oid
          }
        }
      ]
    };
  }

  async listSkillSyncs(d: {
    project: Project;
    instance: Instance;
    ids?: string[];
    skillMarketplaceIds?: string[];
    skillPluginIds?: string[];
    statuses?: SkillSyncStatusFilter[];
    createdAt?: DateFilter;
  }) {
    let skillMarketplaces = await resolveSkillMarketplaces(d, d.skillMarketplaceIds);
    let skillPlugins = await resolveSkillPlugins(d, d.skillPluginIds);
    let destinationFilters: Prisma.SkillDestinationWhereInput[] = [];

    if (skillMarketplaces) {
      destinationFilters.push({ skillMarketplace: { oid: skillMarketplaces.in } });
    }
    if (skillPlugins) {
      destinationFilters.push({ skillPlugin: { oid: skillPlugins.in } });
    }

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skillDestinationSync.findMany({
            ...opts,
            where: {
              id: d.ids?.length ? { in: d.ids } : undefined,
              status: d.statuses?.length ? { in: d.statuses } : { not: 'canceled' },
              createdAt: d.createdAt ? normalizeDateFilter(d.createdAt) : undefined,
              destination: {
                AND: [
                  this.scopeDestinationWhere(d),
                  destinationFilters.length ? { OR: destinationFilters } : undefined!
                ].filter(Boolean)
              }
            },
            include: skillSyncInclude
          })
      )
    );
  }

  async getSkillSyncById(d: { project: Project; instance: Instance; skillSyncId: string }) {
    return await this.getSkillSyncRecord(d);
  }

  async getSkillSyncRepositoryChecks(d: {
    project: Project;
    instance: Instance;
    skillSyncId: string;
  }): Promise<SkillSyncRepositoryCheck[]> {
    let skillSync = await this.getSkillSyncRecord(d);
    let originSyncIds = skillSync.repositoryPropagations.flatMap(propagation =>
      propagation.originSyncId ? [propagation.originSyncId] : []
    );
    let repoIds = skillSync.repositoryPropagations.map(
      propagation => propagation.skillRepository.repoId
    );
    let projectOid =
      skillSync.destination.skillMarketplace?.projectOid ??
      skillSync.destination.skillPlugin?.projectOid;

    if (!projectOid) return [];

    let originTenant = await getOriginTenant({ oid: projectOid });
    let [originSyncs, repositories] = await Promise.all([
      originSyncIds.length
        ? origin.scmRepositorySync.getMany({
            tenantId: originTenant.id,
            scmRepositorySyncIds: originSyncIds
          })
        : Promise.resolve({ syncs: [] }),
      repoIds.length
        ? origin.scmRepository.getMany({
            tenantId: originTenant.id,
            scmRepositoryIds: repoIds
          })
        : Promise.resolve({ repositories: [] })
    ]);
    let originSyncById = new Map(originSyncs.syncs.map(sync => [sync.id, sync]));
    let repositoryById = new Map(
      repositories.repositories.map(repository => [repository.id, repository])
    );

    return skillSync.repositoryPropagations.map(propagation => {
      let originSync = propagation.originSyncId
        ? originSyncById.get(propagation.originSyncId)
        : undefined;
      let repository = repositoryById.get(propagation.skillRepository.repoId);
      let snapshot = originSync?.statusSnapshot as
        | {
            observedAt?: string | Date;
            checks?: {
              state?: string;
              items?: {
                name?: string;
                status?: string;
                url?: string | null;
                summary?: string | null;
              }[];
            };
            review?: {
              state?: string;
              approvals?: number | null;
              requiredApprovals?: number | null;
            };
            mergeability?: {
              state?: string;
              reason?: string;
            };
          }
        | null
        | undefined;
      let isPullRequest = propagation.repositoryAccessMode === 'pull_request';
      let providerUnavailable = Boolean(
        (originSync && isRepositorySyncRetrying(originSync)) ||
        (!originSync && (propagation.errorMessage || propagation.originSyncId))
      );
      let blockers = [
        isPullRequest && snapshot?.checks?.state === 'pending' ? 'checks_pending' : null,
        isPullRequest && snapshot?.checks?.state === 'failed' ? 'checks_failed' : null,
        isPullRequest &&
        ['pending', 'changes_requested'].includes(snapshot?.review?.state ?? '')
          ? 'reviews_required'
          : null,
        isPullRequest && snapshot?.mergeability?.state === 'conflicting'
          ? 'merge_conflict'
          : null,
        isPullRequest && snapshot?.mergeability?.reason === 'merge_permission_required'
          ? 'merge_permission_required'
          : null,
        isPullRequest &&
        snapshot?.mergeability?.state === 'blocked' &&
        snapshot?.mergeability?.reason !== 'merge_permission_required'
          ? 'merge_blocked'
          : null,
        providerUnavailable &&
        ['processing', 'waiting_for_review'].includes(propagation.status)
          ? 'provider_unavailable'
          : null
      ].filter((blocker): blocker is string => blocker != null);

      return {
        propagationId: propagation.id,
        repoId: propagation.skillRepository.repoId,
        provider: repository?.provider ?? null,
        repositoryName: repository
          ? `${repository.externalOwner}/${repository.externalName}`
          : propagation.skillRepository.repoId,
        repositoryUrl: repository?.externalUrl ?? null,
        pullRequestUrl: isPullRequest ? (originSync?.providerPrUrl ?? null) : null,
        repositoryAccessMode: propagation.repositoryAccessMode,
        forceMergeOrPush: propagation.forceMergeOrPush,
        mergeBeforeChecksPass: propagation.mergeBeforeChecksPass,
        overrideAttemptStatus: originSync?.mergeAttemptStatus ?? 'not_attempted',
        overrideRefusalReason: originSync?.mergeAttemptRefusalReason ?? null,
        targetBranch: originSync?.baseBranch ?? repository?.defaultBranch ?? null,
        status: propagation.status,
        originStatus: originSync?.status ?? null,
        blockers,
        checks: (isPullRequest ? (snapshot?.checks?.items ?? []) : []).map(check => ({
          name: check.name ?? 'Repository check',
          status: check.status ?? 'unknown',
          url: check.url ?? null,
          summary: check.summary ?? null
        })),
        reviewStatus: isPullRequest ? (snapshot?.review?.state ?? null) : null,
        requiredReviewCount: isPullRequest
          ? (snapshot?.review?.requiredApprovals ?? null)
          : null,
        approvedReviewCount: isPullRequest ? (snapshot?.review?.approvals ?? null) : null,
        mergeability: isPullRequest ? (snapshot?.mergeability?.state ?? null) : null,
        lastCheckedAt: snapshot?.observedAt ? new Date(snapshot.observedAt) : null,
        errorMessage: propagation.errorMessage ?? originSync?.errorMessage ?? null
      };
    });
  }
}

export let skillSyncService = Service.create(
  'cargoSkillSyncService',
  () => new SkillSyncServiceImpl()
).build();
