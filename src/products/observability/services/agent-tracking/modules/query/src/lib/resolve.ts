import type { FilterValue, QueryError } from '@mtsrc/agent-tracking-query-spec';
import { db, type Organization } from '@mtsrc/agent-tracking-db';
import { entityKindService } from '@mtsrc/agent-tracking-module-entities';
import { knowledgeCacheService } from '@mtsrc/agent-tracking-module-knowledge';
import {
  instanceIdsOfScope,
  type QueryScope,
  resolveQueryScope
} from '@mtsrc/agent-tracking-module-usage';
import {
  type CatalogContext,
  type DatasetDef,
  datasets,
  resolveField,
  type ResolvedField
} from '../catalog';
import { distinctPipeline, maxGroups } from './codegen';
import {
  compileLeaf,
  idNamespace,
  leavesOf,
  type Lookups,
  needsIdResolution,
  positiveOp
} from './compile';
import { type MappedContext, usesRawModels, usesUnresolvedRaws } from './mapped';
import { always, type Predicate } from './predicate';
import type { EffectiveScope } from './scope';
import {
  type BoundLeaf,
  type BoundQuery,
  type PrivacySettings,
  QueryBindError,
  type TimeRange
} from './types';
import { type Collections, runPipeline } from './store';

export let maxSemiJoinKeys = 50_000;

export let semiJoinWidenMs = 7 * 24 * 60 * 60 * 1000;

export let maxRawModels = 5000;

export let maxAttributeEntities = 50_000;

export let defaultMinGroupUsers = 5;

let liveStatuses = ['managed', 'discovered'] as const;

export let privacyOf = (organization: Organization): PrivacySettings => ({
  hideIndividuals: organization.settings.privacy?.hideIndividuals ?? false,
  minGroupUsers: organization.settings.privacy?.minGroupUsers ?? defaultMinGroupUsers
});

export let loadCatalogContext = async (
  organization: Organization
): Promise<CatalogContext> => {
  let kinds = await entityKindService.listKinds({ organization });

  return {
    kinds: new Map(
      kinds.map(kind => [
        kind.key,
        {
          key: kind.key,
          name: kind.name,
          multi: kind.cardinality == 'multi',
          attributes: kind.record?.attributes.queryableAttributes ?? []
        }
      ])
    )
  };
};

export let resolveScope = async (d: {
  organization: Organization;
  scope?: QueryScope;
  dataset: DatasetDef;
}): Promise<EffectiveScope> => {
  let scope = await resolveQueryScope({ organization: d.organization, scope: d.scope });

  if (!d.dataset.scopePaths.project && scope.projectIds) {
    let instanceIds = await instanceIdsOfScope({ organization: d.organization, scope });
    return { organizationId: d.organization.id, instanceIds: instanceIds ?? [] };
  }

  return {
    organizationId: d.organization.id,
    ...(scope.projectIds ? { projectIds: scope.projectIds } : {}),
    ...(scope.instanceIds ? { instanceIds: scope.instanceIds } : {})
  };
};

let listOf = (value: BoundLeaf['value']): FilterValue[] =>
  Array.isArray(value) ? value : value === undefined ? [] : [value];

let identifierOf = (value: string) => {
  if (value.startsWith('slug:')) return { slug: value.slice(5) };
  if (value.startsWith('ref:')) return { ref: value.slice(4) };

  return { id: value };
};

let resolveIdValues = async (d: {
  organization: Organization;
  namespace: string;
  values: string[];
}) => {
  let result = new Map<string, string[]>();
  if (!d.values.length) return result;

  if (d.namespace == 'project' || d.namespace == 'instance') {
    let where = {
      organizationOid: d.organization.oid,
      OR: [{ id: { in: d.values } }, { ref: { in: d.values } }]
    };
    let rows =
      d.namespace == 'project'
        ? await db.project.findMany({ where, select: { id: true, ref: true } })
        : await db.instance.findMany({ where, select: { id: true, ref: true } });

    for (let value of d.values) {
      let ids = rows.filter(row => row.id == value || row.ref == value).map(row => row.id);
      result.set(value, ids);
    }

    return result;
  }

  let identifiers = d.values.map(identifierOf);
  let rows = await db.entity.findMany({
    where: {
      organizationOid: d.organization.oid,
      kind: d.namespace,
      mergedIntoOid: null,
      OR: [
        { slug: { in: identifiers.flatMap(item => (item.slug ? [item.slug] : [])) } },
        { ref: { in: identifiers.flatMap(item => (item.ref ? [item.ref] : [])) } }
      ]
    },
    select: { id: true, slug: true, ref: true }
  });

  d.values.forEach((value, index) => {
    let identifier = identifiers[index]!;
    let ids = rows
      .filter(row =>
        identifier.slug ? row.slug == identifier.slug : row.ref == identifier.ref
      )
      .map(row => row.id);
    result.set(value, ids);
  });

  return result;
};

let attributeMatches = (attribute: unknown, op: BoundLeaf['op'], values: FilterValue[]) => {
  let present = attribute !== null && attribute !== undefined;
  let text = present ? String(attribute).toLowerCase() : '';

  switch (positiveOp(op)) {
    case 'notNull':
      return present;
    case 'eq':
    case 'in':
    case 'any':
      return present && values.some(value => String(value) == String(attribute));
    case 'contains':
      return present && text.includes(String(values[0]).toLowerCase());
    case 'startsWith':
      return present && text.startsWith(String(values[0]).toLowerCase());
    default:
      return false;
  }
};

let resolveAttributeIds = async (d: { organization: Organization; leaf: BoundLeaf }) => {
  let source = d.leaf.field.source as Extract<
    ResolvedField['source'],
    { kind: 'entityAttribute' }
  >;
  let entities = await db.entity.findMany({
    where: { organizationOid: d.organization.oid, kind: source.key, mergedIntoOid: null },
    select: { id: true, attributes: true },
    take: maxAttributeEntities
  });

  return entities
    .filter(entity =>
      attributeMatches(
        (entity.attributes as Record<string, unknown>)[source.attribute],
        d.leaf.op,
        listOf(d.leaf.value)
      )
    )
    .map(entity => entity.id);
};

let isKindLeaf = (leaf: BoundLeaf) =>
  leaf.field.source.kind == 'kind' ||
  (leaf.field.source.kind == 'entityAttribute' && leaf.field.source.via.kind == 'kind');

export type ResolveInput = {
  organization: Organization;
  collections: Collections;
  scope: EffectiveScope;
  dataset: DatasetDef;
  catalog: CatalogContext;
  range: TimeRange;
  timeZone: string;
  strict: boolean;
  leaves: BoundLeaf[];
  mappedFields: ResolvedField[];
  now: Date;
};

export type Resolved = {
  lookups: Lookups;
  warnings: { code: string; message: string }[];
};

let semiJoinKeys = async (
  d: ResolveInput & { lookups: Lookups; leaf: BoundLeaf; warnings: Resolved['warnings'] }
) => {
  let sessions = datasets.sessions;
  let field = resolveField(sessions, d.leaf.field.name, d.catalog);
  if (!field) return [];

  let positive: BoundLeaf = { ...d.leaf, field, op: positiveOp(d.leaf.op) };
  let predicate = compileLeaf(positive, { ...d.lookups, dataset: sessions });
  let range = {
    from: new Date(d.range.from.getTime() - semiJoinWidenMs),
    to: d.range.to
  };
  let rows = await runPipeline<{ _id: string }>({
    collections: d.collections,
    dataset: sessions,
    scope: d.scope,
    pipeline: distinctPipeline({
      dataset: sessions,
      scope: d.scope,
      range,
      predicate,
      path: '_id',
      limit: maxSemiJoinKeys
    })
  });

  if (rows.length > maxSemiJoinKeys) {
    throw new QueryBindError([
      {
        code: 'semi_join_too_large',
        message: `More than ${maxSemiJoinKeys} sessions match "${d.leaf.field.name}". Narrow the range or use the sessions dataset.`,
        pointer: d.leaf.pointer
      }
    ]);
  }

  d.warnings.push({
    code: 'sessionless_excluded',
    message:
      'Kind filters on raw records go through sessions, so records without a session never match.'
  });

  return rows.map(row => row._id);
};

let distinctValues = async (d: {
  collections: Collections;
  dataset: DatasetDef;
  scope: EffectiveScope;
  range: TimeRange;
  path: string;
  predicate?: Predicate;
  array?: boolean;
  limit: number;
}) => {
  let rows = await runPipeline<{ _id: unknown }>({
    collections: d.collections,
    dataset: d.dataset,
    scope: d.scope,
    pipeline: distinctPipeline({
      dataset: d.dataset,
      scope: d.scope,
      range: d.range,
      predicate: d.predicate ?? always,
      path: d.path,
      ...(d.array ? { array: true } : {}),
      limit: d.limit
    })
  });

  return rows.map(row => row._id).filter((value): value is string => typeof value == 'string');
};

export let resolveRawModels = async (raws: string[], now: Date) => {
  let knowledge = await knowledgeCacheService.getKnowledge();
  let result = new Map<string, string | null>();
  if (!knowledge) {
    for (let raw of raws) result.set(raw, null);
    return result;
  }

  let resolver = await knowledge.prepare(raws.map(raw => ({ raw })));
  for (let raw of raws)
    result.set(raw, resolver.resolveModel({ raw, at: now }).modelId ?? null);

  return result;
};

export let buildMappedContext = async (d: {
  collections: Collections;
  dataset: DatasetDef;
  scope: EffectiveScope;
  range: TimeRange;
  fields: ResolvedField[];
  filterFields: ResolvedField[];
  now: Date;
}): Promise<MappedContext | null> => {
  let all = [...d.fields, ...d.filterFields];
  if (!all.some(field => field.source.kind == 'mapped')) return null;

  let maps = await knowledgeCacheService.getDimensionMaps();
  let context: MappedContext = { maps, unresolvedRaws: [] };

  let hinted = d.filterFields.find(field => usesUnresolvedRaws(field.source));
  if (hinted?.source.kind == 'mapped' && hinted.source.raw) {
    context.unresolvedRaws = await distinctValues({
      ...d,
      path: hinted.source.raw,
      predicate: { t: 'null', path: hinted.source.base },
      limit: maxRawModels
    });
  }

  let raw = all.find(field => usesRawModels(field.source));
  if (raw?.source.kind == 'mapped') {
    let raws = await distinctValues({
      ...d,
      path: raw.source.base,
      ...(raw.array ? { array: true } : {}),
      limit: maxRawModels
    });
    context.rawModels = await resolveRawModels(raws.slice(0, maxRawModels), d.now);
  }

  return context;
};

export let resolveLookups = async (input: ResolveInput): Promise<Resolved> => {
  let warnings: Resolved['warnings'] = [];
  let errors: QueryError[] = [];
  let lookups: Lookups = {
    dataset: input.dataset,
    timeZone: input.timeZone,
    ids: new Map(),
    attributeIds: new Map(),
    sessionKeys: new Map(),
    mapped: null
  };

  let wanted = new Map<string, Set<string>>();
  for (let leaf of input.leaves) {
    let namespace = idNamespace(leaf.field);
    if (!namespace) continue;

    for (let value of listOf(leaf.value)) {
      if (typeof value == 'string' && needsIdResolution(leaf.field, value)) {
        let set = wanted.get(namespace) ?? new Set();
        set.add(value);
        wanted.set(namespace, set);
      }
    }
  }

  for (let [namespace, values] of wanted) {
    let resolved = await resolveIdValues({
      organization: input.organization,
      namespace,
      values: [...values]
    });
    for (let [value, ids] of resolved) lookups.ids.set(`${namespace}\u0000${value}`, ids);
  }

  if (input.strict) {
    for (let leaf of input.leaves) {
      let namespace = idNamespace(leaf.field);
      if (!namespace) continue;

      for (let value of listOf(leaf.value)) {
        if (typeof value != 'string' || !needsIdResolution(leaf.field, value)) continue;
        if (!lookups.ids.get(`${namespace}\u0000${value}`)?.length) {
          errors.push({
            code: 'unknown_value',
            message: `No ${namespace} matches "${value}".`,
            pointer: leaf.pointer
          });
        }
      }
    }
  }
  if (errors.length) throw new QueryBindError(errors);

  for (let leaf of input.leaves) {
    if (leaf.field.source.kind == 'entityAttribute') {
      lookups.attributeIds.set(
        leaf.pointer,
        await resolveAttributeIds({ organization: input.organization, leaf })
      );
    }
  }

  lookups.mapped = await buildMappedContext({
    collections: input.collections,
    dataset: input.dataset,
    scope: input.scope,
    range: input.range,
    fields: input.mappedFields,
    filterFields: input.leaves.map(leaf => leaf.field),
    now: input.now
  });

  if (input.dataset.kinds?.kind == 'semiJoin') {
    for (let leaf of input.leaves) {
      if (!isKindLeaf(leaf)) continue;

      lookups.sessionKeys.set(
        leaf.pointer,
        await semiJoinKeys({ ...input, lookups, leaf, warnings })
      );
    }
  }

  return { lookups, warnings };
};

export let queryLeaves = (query: BoundQuery) => [
  ...leavesOf(query.where),
  ...query.measures.flatMap(measure =>
    measure.kind == 'aggregate' || measure.kind == 'reported' ? leavesOf(measure.where) : []
  )
];

export let loadGroupValues = async (d: {
  organization: Organization;
  scope: EffectiveScope;
  kind: string;
}) => {
  let projects = d.scope.projectIds
    ? await db.project.findMany({
        where: { organizationOid: d.organization.oid, id: { in: d.scope.projectIds } },
        select: { oid: true }
      })
    : null;

  let entities = await db.entity.findMany({
    where: {
      organizationOid: d.organization.oid,
      kind: d.kind,
      status: { in: [...liveStatuses] },
      archivedAt: null,
      mergedIntoOid: null,
      ...(projects
        ? {
            OR: [
              { scopeProjectOid: null },
              { scopeProjectOid: { in: projects.map(project => project.oid) } }
            ]
          }
        : {})
    },
    select: { id: true },
    orderBy: { oid: 'asc' },
    take: maxGroups + 1
  });

  if (entities.length > maxGroups) {
    throw new QueryBindError([
      {
        code: 'too_many_groups',
        message: `fill.groups works for at most ${maxGroups} entities.`,
        pointer: '/fill/groups'
      }
    ]);
  }

  return entities.map(entity => entity.id);
};
