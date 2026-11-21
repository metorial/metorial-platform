import type { EntityStatus, Prisma } from '@mtsrc/agent-tracking-db';

// Slugs are stored lowercase, so a lowercased search matches them regardless of case.
export let entitySearchWhere = (
  search: string,
  d: { identifierType?: string } = {}
): Prisma.EntityWhereInput => ({
  OR: [
    { name: { contains: search, mode: 'insensitive' } },
    { slug: { contains: search.toLowerCase() } },
    {
      identifiers: {
        some: { type: d.identifierType, value: { contains: search, mode: 'insensitive' } }
      }
    }
  ]
});

export let entityListWhere = (d: {
  organizationOid: bigint;
  kinds?: string[];
  statuses: EntityStatus[];
  needsReview?: boolean;
  ids?: string[];
  scopeProjectOid?: bigint | null;
  scopeInstanceOid?: bigint | null;
  search?: string;
}): Prisma.EntityWhereInput => ({
  organizationOid: d.organizationOid,
  kind: d.kinds ? { in: d.kinds } : undefined,
  status: { in: d.statuses },
  needsReview: d.needsReview,
  id: d.ids ? { in: d.ids } : undefined,
  AND: [
    ...(d.scopeProjectOid
      ? [{ OR: [{ scopeProjectOid: null }, { scopeProjectOid: d.scopeProjectOid }] }]
      : []),
    ...(d.scopeInstanceOid
      ? [{ OR: [{ scopeInstanceOid: null }, { scopeInstanceOid: d.scopeInstanceOid }] }]
      : []),
    ...(d.search ? [entitySearchWhere(d.search)] : [])
  ]
});
