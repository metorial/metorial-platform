import { versionKey } from '@mtsrc/agent-tracking-spec';
import {
  type FilterOp,
  type FilterValue,
  parseInstant
} from '@mtsrc/agent-tracking-query-spec';
import {
  dayNames,
  type DatasetDef,
  type ResolvedField,
  sourceKindPath,
  sourceKinds
} from '../catalog';
import { anyValue, type MappedContext, mappedPredicate } from './mapped';
import { always, and, escapeRegExp, never, not, or, type Predicate } from './predicate';
import type { BoundFilter, BoundLeaf } from './types';

export type Lookups = {
  dataset: DatasetDef;
  timeZone: string;
  // `${namespace}\u0000${value}` → ids, where namespace is an entity kind, 'project' or 'instance'.
  ids: Map<string, string[]>;
  // Leaf pointer → entity ids matching the leaf's positive form (entity attribute filters).
  attributeIds: Map<string, string[]>;
  // Leaf pointer → session keys matching the leaf's positive form (kind filters on raw datasets).
  sessionKeys: Map<string, string[]>;
  mapped: MappedContext | null;
};

let negativeOps = new Set<FilterOp>(['neq', 'notIn', 'none', 'isNull']);

export let positiveOp = (op: FilterOp): FilterOp =>
  op == 'neq'
    ? 'eq'
    : op == 'notIn'
      ? 'in'
      : op == 'none'
        ? 'any'
        : op == 'isNull'
          ? 'notNull'
          : op;

export let isNegativeOp = (op: FilterOp) => negativeOps.has(op);

let listOf = (value: BoundLeaf['value']): FilterValue[] =>
  Array.isArray(value) ? value : value === undefined ? [] : [value];

export let idNamespace = (field: ResolvedField) => {
  if (field.name == 'metorial.project') return 'project';
  if (field.name == 'metorial.instance') return 'instance';
  if (field.source.kind == 'entityAttribute') return undefined;

  return field.entityKind;
};

export let needsIdResolution = (field: ResolvedField, value: string) => {
  let namespace = idNamespace(field);
  if (!namespace) return false;
  if (namespace == 'project' || namespace == 'instance') return true;

  return value.startsWith('slug:') || value.startsWith('ref:');
};

let resolveIds = (lookups: Lookups, field: ResolvedField, values: FilterValue[]) =>
  values.flatMap(value => {
    if (typeof value != 'string' || !needsIdResolution(field, value)) return [value];
    return lookups.ids.get(`${idNamespace(field)}\u0000${value}`) ?? [];
  });

let pathOf = (field: ResolvedField) => {
  let source = field.source;
  if (source.kind == 'stored' || source.kind == 'array') return source.path;

  throw new Error(`Field "${field.name}" has no stored path.`);
};

let convert = (field: ResolvedField, value: FilterValue, lookups: Lookups): unknown => {
  if (field.type == 'date' && typeof value == 'string')
    return parseInstant(value, lookups.timeZone);
  return value;
};

let inList = (path: string, values: unknown[], array?: boolean): Predicate =>
  values.length ? { t: 'cmp', path, op: 'in', value: values, array } : never;

let compareLeaf = (
  path: string,
  op: FilterOp,
  values: unknown[],
  array?: boolean
): Predicate => {
  switch (op) {
    case 'eq':
    case 'any':
    case 'in':
      return inList(path, values, array);
    case 'neq':
    case 'none':
    case 'notIn':
      return not(inList(path, values, array));
    case 'all':
      return values.length ? { t: 'all', path, values } : always;
    case 'isNull':
      return { t: 'null', path, array };
    case 'notNull':
      return not({ t: 'null', path, array });
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return { t: 'cmp', path, op, value: values[0], array };
    case 'between':
      return and([
        { t: 'cmp', path, op: 'gte', value: values[0], array },
        { t: 'cmp', path, op: 'lte', value: values[1], array }
      ]);
    case 'contains':
      return { t: 'regex', path, patterns: [escapeRegExp(String(values[0]))], array };
    case 'startsWith':
      return { t: 'regex', path, patterns: [`^${escapeRegExp(String(values[0]))}`], array };
  }
};

let storedLeaf = (leaf: BoundLeaf, lookups: Lookups): Predicate => {
  let { field, op } = leaf;
  let source = field.source as Extract<ResolvedField['source'], { kind: 'stored' | 'array' }>;
  let values = resolveIds(lookups, field, listOf(leaf.value)).map(value =>
    convert(field, value as FilterValue, lookups)
  );

  if (field.type == 'version' && source.kind == 'stored' && source.versionKeyPath) {
    if (['gt', 'gte', 'lt', 'lte', 'between'].includes(op)) {
      return compareLeaf(
        source.versionKeyPath,
        op,
        values.map(value => versionKey(String(value)))
      );
    }
  }

  return compareLeaf(pathOf(field), op, values, field.array);
};

let kindLeaf = (leaf: BoundLeaf, lookups: Lookups): Predicate => {
  let kinds = lookups.dataset.kinds;
  let key = (leaf.field.source as { key: string }).key;

  if (kinds?.kind == 'semiJoin') {
    let keys = lookups.sessionKeys.get(leaf.pointer) ?? [];
    let positive = inList(kinds.sessionKeyPath, keys);

    return isNegativeOp(leaf.op) ? not(positive) : positive;
  }
  if (kinds?.kind != 'embedded') return never;

  let hasKind: Predicate = {
    t: 'elem',
    path: kinds.arrayPath,
    item: { t: 'cmp', path: 'kind', op: 'eq', value: key }
  };

  if (leaf.op == 'isNull') return not(hasKind);
  if (leaf.op == 'notNull') return hasKind;

  let values = resolveIds(lookups, leaf.field, listOf(leaf.value));
  return compareLeaf(kinds.idsPath, leaf.op, values, true);
};

let attributeLeaf = (leaf: BoundLeaf, lookups: Lookups): Predicate => {
  let source = leaf.field.source as Extract<
    ResolvedField['source'],
    { kind: 'entityAttribute' }
  >;
  let kinds = lookups.dataset.kinds;
  let positive: Predicate;

  if (source.via.kind == 'field') {
    let target = lookups.dataset.fields[source.via.field]!;
    let ids = lookups.attributeIds.get(leaf.pointer) ?? [];
    positive = inList((target.source as { path: string }).path, ids, target.array);
  } else if (kinds?.kind == 'semiJoin') {
    positive = inList(kinds.sessionKeyPath, lookups.sessionKeys.get(leaf.pointer) ?? []);
  } else if (kinds?.kind == 'embedded') {
    positive = inList(kinds.idsPath, lookups.attributeIds.get(leaf.pointer) ?? [], true);
  } else {
    positive = never;
  }

  return isNegativeOp(leaf.op) ? not(positive) : positive;
};

let tagLeaf = (leaf: BoundLeaf, lookups: Lookups): Predicate => {
  let key = (leaf.field.source as { key: string }).key;
  let path = lookups.dataset.tagsPath!;
  let withKey = (value?: Predicate): Predicate => ({
    t: 'elem',
    path,
    item: and([{ t: 'cmp', path: 'k', op: 'eq', value: key }, ...(value ? [value] : [])])
  });

  if (leaf.op == 'isNull') return not(withKey());
  if (leaf.op == 'notNull') return withKey();

  let positive = withKey(compareLeaf('v', positiveOp(leaf.op), listOf(leaf.value)));
  return isNegativeOp(leaf.op) ? not(positive) : positive;
};

let mappedLeaf = (leaf: BoundLeaf, lookups: Lookups): Predicate => {
  let source = leaf.field.source as Extract<ResolvedField['source'], { kind: 'mapped' }>;
  if (!lookups.mapped) throw new Error('Mapped fields need their knowledge maps.');

  let values = listOf(leaf.value).map(value => String(value));
  let positive =
    leaf.op == 'isNull' || leaf.op == 'notNull'
      ? mappedPredicate(source, anyValue, lookups.mapped, leaf.field.array)
      : mappedPredicate(source, values, lookups.mapped, leaf.field.array);

  return isNegativeOp(leaf.op) ? not(positive) : positive;
};

let existsLeaf = (leaf: BoundLeaf): Predicate => {
  let path = (leaf.field.source as { path: string }).path;
  let present = not({ t: 'null', path });

  if (leaf.op == 'isNull') return never;
  if (leaf.op == 'notNull') return always;

  let wanted = leaf.value === true;
  let matches = wanted ? present : not(present);

  return leaf.op == 'eq' ? matches : not(matches);
};

let dayNumber = (value: FilterValue) =>
  dayNames.indexOf(value as (typeof dayNames)[number]) + 1;

let cyclicLeaf = (leaf: BoundLeaf, lookups: Lookups): Predicate => {
  let source = leaf.field.source as Extract<ResolvedField['source'], { kind: 'cyclic' }>;
  let values = listOf(leaf.value).map(value =>
    source.unit == 'dayOfWeek' ? dayNumber(value) : value
  );
  let base = {
    t: 'cyclic' as const,
    unit: source.unit,
    path: lookups.dataset.timeField,
    timeZone: lookups.timeZone,
    ...(lookups.dataset.dailyBuckets
      ? { dailyPath: lookups.dataset.dailyBuckets.minutesPath }
      : {})
  };

  switch (leaf.op) {
    case 'eq':
      return { ...base, op: 'eq', value: values[0] };
    case 'neq':
      return { ...base, op: 'ne', value: values[0] };
    case 'in':
      return values.length ? { ...base, op: 'in', value: values } : never;
    case 'notIn':
      return values.length ? { ...base, op: 'nin', value: values } : always;
    case 'between':
      return and([
        { ...base, op: 'gte', value: values[0] },
        { ...base, op: 'lte', value: values[1] }
      ]);
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return { ...base, op: leaf.op, value: values[0] };
    default:
      return never;
  }
};

let sourceKindsLeaf = (leaf: BoundLeaf): Predicate => {
  let seen = (kind: string) =>
    not({ t: 'null', path: sourceKindPath(kind as (typeof sourceKinds)[number]) });
  let values = listOf(leaf.value).map(String);

  switch (leaf.op) {
    case 'isNull':
      return not(or(sourceKinds.map(seen)));
    case 'notNull':
      return or(sourceKinds.map(seen));
    case 'all':
      return and(values.map(seen));
    default: {
      let positive = or(values.map(seen));
      return isNegativeOp(leaf.op) ? not(positive) : positive;
    }
  }
};

export let compileLeaf = (leaf: BoundLeaf, lookups: Lookups): Predicate => {
  switch (leaf.field.source.kind) {
    case 'stored':
    case 'array':
      return storedLeaf(leaf, lookups);
    case 'kind':
      return kindLeaf(leaf, lookups);
    case 'entityAttribute':
      return attributeLeaf(leaf, lookups);
    case 'tag':
      return tagLeaf(leaf, lookups);
    case 'mapped':
      return mappedLeaf(leaf, lookups);
    case 'exists':
      return existsLeaf(leaf);
    case 'cyclic':
      return cyclicLeaf(leaf, lookups);
    case 'sourceKinds':
      return sourceKindsLeaf(leaf);
    default:
      throw new Error(`Field "${leaf.field.name}" can't be filtered.`);
  }
};

export let compileFilter = (filter: BoundFilter | undefined, lookups: Lookups): Predicate => {
  if (!filter) return always;
  if ('and' in filter) return and(filter.and.map(item => compileFilter(item, lookups)));
  if ('or' in filter) return or(filter.or.map(item => compileFilter(item, lookups)));
  if ('not' in filter) return not(compileFilter(filter.not, lookups));

  return compileLeaf(filter.leaf, lookups);
};

export let leavesOf = (filter: BoundFilter | undefined): BoundLeaf[] => {
  if (!filter) return [];
  if ('and' in filter) return filter.and.flatMap(leavesOf);
  if ('or' in filter) return filter.or.flatMap(leavesOf);
  if ('not' in filter) return leavesOf(filter.not);

  return [filter.leaf];
};

// Top-level conjuncts, the only leaves whose positive values may narrow split weights or scope.
export let conjunctsOf = (filter: BoundFilter | undefined): BoundLeaf[] => {
  if (!filter) return [];
  if ('and' in filter) return filter.and.flatMap(conjunctsOf);
  if ('leaf' in filter) return [filter.leaf];

  return [];
};
