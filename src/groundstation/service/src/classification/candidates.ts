import type { Entity, Instance, Organization } from '../../prisma/generated/client';
import { db } from '../db';
import { mergeKindDefinitions } from '../entities/kinds';

let maxCandidateEntities = 5000;

let unclassifiableKinds = [
  'user',
  'device',
  'client_user',
  'client_installation',
  'agent',
  'team'
];

export type CandidateEntity = {
  id: string;
  kind: string;
  name: string;
  description?: string;
  keywords: string[];
  repos: string[];
  ticketPrefixes: string[];
  scoped: boolean;
};

export type ClassifiableKind = {
  key: string;
  name: string;
  candidates: CandidateEntity[];
};

let stringList = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item == 'string' && !!item.trim())
    : typeof value == 'string' && value.trim()
      ? [value]
      : [];

export let isClassifiableKind = (key: string) => !unclassifiableKinds.includes(key);

export let toCandidate = (
  entity: Pick<
    Entity,
    'id' | 'kind' | 'name' | 'slug' | 'attributes' | 'scopeProjectOid' | 'scopeInstanceOid'
  >
): CandidateEntity => {
  let attributes = entity.attributes ?? {};
  let description =
    typeof attributes.description == 'string' && attributes.description.trim()
      ? attributes.description.trim()
      : undefined;

  return {
    id: entity.id,
    kind: entity.kind,
    name: entity.name ?? entity.slug ?? entity.id,
    description,
    keywords: stringList(attributes.keywords),
    repos: stringList(attributes.repos),
    ticketPrefixes: stringList(attributes.ticketPrefixes).map(prefix =>
      prefix.trim().toUpperCase()
    ),
    scoped: entity.scopeProjectOid != null || entity.scopeInstanceOid != null
  };
};

export let loadClassifiableKinds = async (d: {
  organization: Organization;
  instance: Instance;
  excludeKinds: Set<string>;
}): Promise<ClassifiableKind[]> => {
  let [kindRecords, entities] = await Promise.all([
    db.entityKind.findMany({ where: { organizationOid: d.organization.oid } }),
    db.entity.findMany({
      where: {
        organizationOid: d.organization.oid,
        status: 'managed',
        kind: { notIn: [...unclassifiableKinds, ...d.excludeKinds] },
        AND: [
          { OR: [{ scopeProjectOid: null }, { scopeProjectOid: d.instance.projectOid }] },
          { OR: [{ scopeInstanceOid: null }, { scopeInstanceOid: d.instance.oid }] }
        ]
      },
      orderBy: { oid: 'asc' },
      take: maxCandidateEntities
    })
  ]);

  let candidatesByKind = new Map<string, CandidateEntity[]>();
  for (let entity of entities) {
    let list = candidatesByKind.get(entity.kind) ?? [];
    list.push(toCandidate(entity));
    candidatesByKind.set(entity.kind, list);
  }

  return mergeKindDefinitions(kindRecords)
    .filter(kind => candidatesByKind.has(kind.key))
    .map(kind => ({
      key: kind.key,
      name: kind.name,
      candidates: candidatesByKind.get(kind.key)!
    }));
};
