import { notFoundError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  MergeSuggestion,
  MergeSuggestionStatus,
  Organization,
  Prisma
} from '../../prisma/generated/client';
import { db } from '../db';
import { candidateKeys, scoreMergeCandidate, type ScoredUser } from '../entities/mergeScoring';
import { getId } from '../id';
import { entityInclude } from './entity';

export let mergeSuggestionInclude = {
  discoveredEntity: { include: entityInclude },
  managedEntity: { include: entityInclude }
} satisfies Prisma.MergeSuggestionInclude;

class MergeSuggestionServiceImpl {
  async listMergeSuggestions(d: {
    organization: Organization;
    statuses?: MergeSuggestionStatus[];
    entityId?: string;
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.mergeSuggestion.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid,
              status: { in: d.statuses ?? ['open'] },
              OR: d.entityId
                ? [
                    { discoveredEntity: { id: d.entityId } },
                    { managedEntity: { id: d.entityId } }
                  ]
                : undefined
            },
            include: mergeSuggestionInclude
          })
      )
    );
  }

  async getMergeSuggestionById(d: { organization: Organization; mergeSuggestionId: string }) {
    let suggestion = await db.mergeSuggestion.findFirst({
      where: { id: d.mergeSuggestionId, organizationOid: d.organization.oid },
      include: mergeSuggestionInclude
    });
    if (!suggestion) {
      throw new ServiceError(notFoundError('merge_suggestion', d.mergeSuggestionId));
    }

    return suggestion;
  }

  async dismissMergeSuggestion(d: { mergeSuggestion: MergeSuggestion }) {
    if (d.mergeSuggestion.status == 'accepted') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'An accepted merge suggestion cannot be dismissed.'
        })
      );
    }

    return await db.mergeSuggestion.update({
      where: { oid: d.mergeSuggestion.oid },
      data: { status: 'dismissed' },
      include: mergeSuggestionInclude
    });
  }

  async refreshMergeSuggestions(d: { organization: Organization }) {
    let users = await db.entity.findMany({
      where: {
        organizationOid: d.organization.oid,
        kind: 'user',
        status: { in: ['managed', 'discovered'] }
      },
      include: { identifiers: { where: { type: 'email' } } }
    });

    let discovered = users.filter(user => user.status == 'discovered');
    let managed = users.filter(user => user.status == 'managed');
    if (!discovered.length || !managed.length) return { suggested: 0 };

    let clientIdentities = await this.clientIdentitiesByUser({ organization: d.organization });

    let scored = new Map<bigint, ScoredUser>(
      users.map(user => [
        user.oid,
        {
          id: user.id,
          name: user.name,
          emails: user.identifiers.map(identifier => identifier.value),
          clientIdentityIds: [...(clientIdentities.get(user.oid) ?? [])]
        }
      ])
    );

    let managedByKey = new Map<string, bigint[]>();
    for (let user of managed) {
      for (let key of candidateKeys(scored.get(user.oid)!)) {
        managedByKey.set(key, [...(managedByKey.get(key) ?? []), user.oid]);
      }
    }

    let suggestions: {
      discoveredOid: bigint;
      managedOid: bigint;
      score: number;
      reasons: string[];
    }[] = [];

    for (let user of discovered) {
      let candidate = scored.get(user.oid)!;
      let managedOids = new Set(
        candidateKeys(candidate).flatMap(key => managedByKey.get(key) ?? [])
      );

      for (let managedOid of managedOids) {
        let result = scoreMergeCandidate({
          discovered: candidate,
          managed: scored.get(managedOid)!,
          allowedEmailDomains: d.organization.settings.allowedEmailDomains
        });

        if (result) suggestions.push({ discoveredOid: user.oid, managedOid, ...result });
      }
    }

    let existing = await db.mergeSuggestion.findMany({
      where: { organizationOid: d.organization.oid }
    });
    let existingByPair = new Map(
      existing.map(suggestion => [
        `${suggestion.discoveredEntityOid}:${suggestion.managedEntityOid}`,
        suggestion
      ])
    );

    let created = suggestions.filter(
      suggestion => !existingByPair.has(`${suggestion.discoveredOid}:${suggestion.managedOid}`)
    );

    await db.mergeSuggestion.createMany({
      data: created.map(suggestion => ({
        ...getId('mergeSuggestion'),
        score: suggestion.score,
        reasons: suggestion.reasons,
        organizationOid: d.organization.oid,
        discoveredEntityOid: suggestion.discoveredOid,
        managedEntityOid: suggestion.managedOid
      })),
      skipDuplicates: true
    });

    for (let suggestion of suggestions) {
      let current = existingByPair.get(`${suggestion.discoveredOid}:${suggestion.managedOid}`);
      if (!current || current.status != 'open') continue;
      if (
        current.score == suggestion.score &&
        current.reasons.join() == suggestion.reasons.join()
      ) {
        continue;
      }

      await db.mergeSuggestion.update({
        where: { oid: current.oid },
        data: { score: suggestion.score, reasons: suggestion.reasons }
      });
    }

    return { suggested: suggestions.length };
  }

  private async clientIdentitiesByUser(d: { organization: Organization }) {
    let ownedBy = await db.entityLink.findMany({
      where: {
        organizationOid: d.organization.oid,
        type: 'owned_by',
        from: { kind: { in: ['client_user', 'device'] } },
        to: { kind: 'user' }
      },
      select: { fromOid: true, toOid: true, from: { select: { kind: true } } }
    });

    let installations = await db.entityLink.findMany({
      where: {
        organizationOid: d.organization.oid,
        type: 'part_of',
        from: { kind: 'client_installation' },
        to: { kind: 'device' }
      },
      select: { fromOid: true, toOid: true }
    });

    let identities = new Map<bigint, Set<string>>();
    let add = (userOid: bigint, identity: bigint) =>
      identities.set(userOid, (identities.get(userOid) ?? new Set()).add(identity.toString()));

    let deviceOwners = new Map<bigint, bigint[]>();
    for (let link of ownedBy) {
      if (link.from.kind == 'client_user') add(link.toOid, link.fromOid);
      else
        deviceOwners.set(link.fromOid, [
          ...(deviceOwners.get(link.fromOid) ?? []),
          link.toOid
        ]);
    }

    for (let link of installations) {
      for (let userOid of deviceOwners.get(link.toOid) ?? []) add(userOid, link.fromOid);
    }

    return identities;
  }
}

export let mergeSuggestionService = Service.create(
  'mergeSuggestionService',
  () => new MergeSuggestionServiceImpl()
).build();
