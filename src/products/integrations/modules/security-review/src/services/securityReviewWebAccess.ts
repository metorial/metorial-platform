import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, getId, withTransaction, type Prisma } from '@metorial-subspace/db';
import type { WebAccessEvent } from '@metorial/review-engine';

class SecurityReviewWebAccessServiceImpl {
  async recordAccess(d: { runOid: bigint; event: WebAccessEvent }) {
    let { event } = d;
    let values = {
      lastOutcome: event.outcome,
      lastReason: event.reason,
      retriever: event.retriever,
      lastAttemptAt: event.attemptedAt,
      ...(event.usedAt ? { lastUsedAt: event.usedAt } : {}),
      ...(event.reputation
        ? {
            reputation: event.reputation.verdict,
            threatTypes: event.reputation.threatTypes,
            reputationCheckedAt: event.reputation.checkedAt
          }
        : {})
    };
    let counts = {
      attempts: 1,
      dispatched: Number(event.dispatched),
      succeeded: Number(event.outcome == 'succeeded'),
      blocked: Number(event.outcome == 'blocked'),
      failed: Number(event.outcome == 'failed')
    };
    let increment = {
      attempts: { increment: counts.attempts },
      dispatched: { increment: counts.dispatched },
      succeeded: { increment: counts.succeeded },
      blocked: { increment: counts.blocked },
      failed: { increment: counts.failed }
    };

    await withTransaction(async () => {
      let run = await db.securityReviewRun.findUniqueOrThrow({
        where: { oid: d.runOid },
        select: { revision: { select: { reviewOid: true } } }
      });
      let domain = await db.securityReviewWebDomainUsage.upsert({
        where: { domain: event.domain },
        create: {
          ...getId('securityReviewWebDomainUsage'),
          domain: event.domain,
          lastOperation: event.operation,
          firstSeenAt: event.attemptedAt,
          threatTypes: [],
          ...counts,
          ...values
        },
        update: increment
      });
      await db.securityReviewWebDomainUsageReview.upsert({
        where: {
          domainUsageOid_reviewOid: {
            domainUsageOid: domain.oid,
            reviewOid: run.revision.reviewOid
          }
        },
        create: {
          ...getId('securityReviewWebDomainUsageReview'),
          domainUsageOid: domain.oid,
          reviewOid: run.revision.reviewOid
        },
        update: {}
      });

      await this.updateTimestamps({ domainOid: domain.oid, event });
    });
  }

  private async updateTimestamps(d: { domainOid: bigint; event: WebAccessEvent }) {
    let { event } = d;
    let latest = {
      lastOutcome: event.outcome,
      lastReason: event.reason,
      retriever: event.retriever,
      lastAttemptAt: event.attemptedAt
    };

    await db.securityReviewWebDomainUsage.updateMany({
      where: { oid: d.domainOid, lastAttemptAt: { lte: event.attemptedAt } },
      data: { ...latest, lastOperation: event.operation }
    });

    await db.securityReviewWebDomainUsage.updateMany({
      where: { oid: d.domainOid, firstSeenAt: { gt: event.attemptedAt } },
      data: { firstSeenAt: event.attemptedAt }
    });

    if (event.usedAt) {
      let used = { OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: event.usedAt } }] };
      await db.securityReviewWebDomainUsage.updateMany({
        where: { oid: d.domainOid, ...used },
        data: { lastUsedAt: event.usedAt }
      });
    }

    if (event.reputation) {
      let checked = {
        OR: [
          { reputationCheckedAt: null },
          { reputationCheckedAt: { lt: event.reputation.checkedAt } }
        ]
      };
      let reputation = {
        reputation: event.reputation.verdict,
        threatTypes: event.reputation.threatTypes,
        reputationCheckedAt: event.reputation.checkedAt
      };
      await db.securityReviewWebDomainUsage.updateMany({
        where: { oid: d.domainOid, ...checked },
        data: reputation
      });
    }
  }

  async listDomains(d: {
    securityReviewId?: string;
    providerId?: string;
    domain?: string;
    outcome?: 'succeeded' | 'blocked' | 'failed';
    operation?: 'fetch' | 'search';
    since?: Date;
    until?: Date;
  }) {
    let where: Prisma.SecurityReviewWebDomainUsageWhereInput = {
      domain: d.domain ? { contains: d.domain.toLowerCase() } : undefined,
      ...(d.outcome ? { [d.outcome]: { gt: 0 } } : {}),
      lastOperation: d.operation,
      lastAttemptAt: d.since || d.until ? { gte: d.since, lte: d.until } : undefined,
      reviews:
        d.securityReviewId || d.providerId
          ? {
              some: {
                review: {
                  id: d.securityReviewId,
                  provider: d.providerId ? { id: d.providerId } : undefined
                }
              }
            }
          : undefined
    };

    return Paginator.create(() => async input => {
      let reverse = !!input.before;
      let ascending = input.order == 'asc' ? !reverse : reverse;
      let cursor = input.after ?? input.before;
      let rows = await db.securityReviewWebDomainUsage.findMany({
        where: {
          AND: [where, cursor ? { domain: ascending ? { gt: cursor } : { lt: cursor } } : {}]
        },
        orderBy: { domain: ascending ? 'asc' : 'desc' },
        take: input.limit + 1,
        include: { _count: { select: { reviews: true } } }
      });
      let hasMore = rows.length > input.limit;
      let page = rows.slice(0, input.limit);
      if (reverse) page.reverse();

      let items = page.map(domain => ({
        id: domain.domain,
        domain: domain.domain,
        attempts: domain.attempts,
        dispatched: domain.dispatched,
        succeeded: domain.succeeded,
        blocked: domain.blocked,
        failed: domain.failed,
        firstSeenAt: domain.firstSeenAt,
        lastAttemptAt: domain.lastAttemptAt,
        lastUsedAt: domain.lastUsedAt,
        lastOutcome: domain.lastOutcome,
        lastReason: domain.lastReason,
        retriever: domain.retriever,
        operation: domain.lastOperation,
        reputation: domain.reputation,
        threatTypes: domain.threatTypes,
        reputationCheckedAt: domain.reputationCheckedAt,
        reviewCount: domain._count.reviews
      }));

      return {
        items,
        pagination: {
          hasNextPage: reverse ? !!cursor : hasMore,
          hasPreviousPage: reverse ? hasMore : !!cursor,
          after: items.at(-1)?.id,
          before: items[0]?.id
        }
      };
    });
  }
}

export let securityReviewWebAccessService = Service.create(
  'securityReviewWebAccessService',
  () => new SecurityReviewWebAccessServiceImpl()
).build();
