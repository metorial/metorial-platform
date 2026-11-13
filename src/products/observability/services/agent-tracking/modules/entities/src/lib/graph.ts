import { withTransaction } from '@mtsrc/agent-tracking-db';
import { linkPropagates } from './linkRules';

let defaultMaxHops = 4;

export type GraphLink = {
  id: string;
  type: string;
  fromId: string;
  fromKind: string;
  toId: string;
  toKind: string;
  weight: number | null;
  validFrom: Date;
  validTo: Date | null;
};

export type ReachedEntity = {
  entityId: string;
  kind: string;
  startId: string;
  hops: number;
  weight: number;
  via: string[];
  linkIds: string[];
};

export let isLinkValidAt = (link: Pick<GraphLink, 'validFrom' | 'validTo'>, at: Date) =>
  link.validFrom.getTime() <= at.getTime() &&
  (link.validTo == null || link.validTo.getTime() > at.getTime());

export let loadActiveLinks = async (d: {
  organizationOid: bigint;
  at: Date | { from: Date; to: Date };
}): Promise<GraphLink[]> => {
  let window = d.at instanceof Date ? { from: d.at, to: d.at } : d.at;
  let liveEntity = { status: { not: 'merged' as const } };

  let links = await withTransaction(
    async db =>
      await db.entityLink.findMany({
        where: {
          organizationOid: d.organizationOid,
          validFrom: { lte: window.to },
          OR: [{ validTo: null }, { validTo: { gt: window.from } }],
          from: liveEntity,
          to: liveEntity
        },
        include: { from: true, to: true }
      }),
    { ifExists: true }
  );

  return links.map(link => ({
    id: link.id,
    type: link.type,
    fromId: link.from.id,
    fromKind: link.from.kind,
    toId: link.to.id,
    toKind: link.to.kind,
    weight: link.weight,
    validFrom: link.validFrom,
    validTo: link.validTo
  }));
};

let isBetter = (candidate: ReachedEntity, current: ReachedEntity) => {
  if (candidate.hops != current.hops) return candidate.hops < current.hops;
  if (candidate.weight != current.weight) return candidate.weight > current.weight;

  return candidate.startId < current.startId;
};

// Walks every simple path (no entity repeated) of at most `maxHops` propagating links. An entity
// reached through several paths from the same start sums their weights, so a user in two teams
// of one cost center still counts fully for it (capped at 1); across starts the closest start
// wins.
export let reachableEntities = (
  startIds: string[],
  links: GraphLink[],
  at: Date,
  opts: { maxHops?: number; staffingPropagates?: boolean } = {}
): ReachedEntity[] => {
  let maxHops = opts.maxHops ?? defaultMaxHops;
  let starts = new Set(startIds);

  let outgoing = new Map<string, GraphLink[]>();
  for (let link of links) {
    if (link.fromId == link.toId || !isLinkValidAt(link, at)) continue;
    if (!linkPropagates(link, { staffingPropagates: opts.staffingPropagates })) continue;

    let list = outgoing.get(link.fromId) ?? [];
    list.push(link);
    outgoing.set(link.fromId, list);
  }

  let shareOf = (link: GraphLink, siblings: GraphLink[]) => {
    if (link.weight != null) return link.weight;

    return 1 / siblings.filter(sibling => sibling.toKind == link.toKind).length;
  };

  let best = new Map<string, ReachedEntity>();

  for (let startId of [...starts].sort()) {
    let reached = new Map<string, ReachedEntity>();

    let walk = (
      entityId: string,
      path: string[],
      linkIds: string[],
      weight: number,
      visited: Set<string>
    ) => {
      let siblings = outgoing.get(entityId) ?? [];

      for (let link of siblings) {
        if (visited.has(link.toId)) continue;

        let nextWeight = weight * shareOf(link, siblings);
        let nextPath = [...path, entityId];
        let nextLinkIds = [...linkIds, link.id];

        let existing = reached.get(link.toId);
        let entry: ReachedEntity = {
          entityId: link.toId,
          kind: link.toKind,
          startId,
          hops: nextPath.length,
          weight: nextWeight,
          via: nextPath,
          linkIds: nextLinkIds
        };

        if (!existing) {
          reached.set(link.toId, entry);
        } else {
          let summed = Math.min(1, existing.weight + nextWeight);
          let shape = isBetter(entry, existing) ? entry : existing;
          reached.set(link.toId, { ...shape, weight: summed });
        }

        if (nextPath.length < maxHops) {
          walk(link.toId, nextPath, nextLinkIds, nextWeight, new Set([...visited, link.toId]));
        }
      }
    };

    walk(startId, [], [], 1, new Set([startId]));

    for (let [entityId, entry] of reached) {
      if (starts.has(entityId)) continue;

      let current = best.get(entityId);
      if (!current || isBetter(entry, current)) best.set(entityId, entry);
    }
  }

  return [...best.values()].sort(
    (a, b) => a.hops - b.hops || a.entityId.localeCompare(b.entityId)
  );
};
