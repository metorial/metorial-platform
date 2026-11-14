import { createHmac, timingSafeEqual } from 'node:crypto';
import mongoose from 'mongoose';
import { formatInZone, wallTimeOf } from '@mtsrc/agent-tracking-query-spec';
import {
  dayNames,
  type DatasetDef,
  type ResolvedField,
  sourceKindPath,
  sourceKinds
} from '../catalog';
import { type MappedContext, mapValue } from './mapped';
import { and, or, type Predicate } from './predicate';
import { type EffectiveScope, scan, type Stage } from './scope';
import type { BoundQuery } from './types';

export type RowsCursor = { value: unknown; id: string };

export class InvalidCursorError extends Error {}

let encodeValue = (value: unknown) => {
  if (value instanceof Date) return { $date: value.toISOString() };
  if (value instanceof mongoose.mongo.Decimal128) return { $decimal: value.toString() };

  return value;
};

let decodeValue = (value: unknown) => {
  if (!value || typeof value != 'object') return value;
  if ('$date' in value) return new Date(String((value as { $date: string }).$date));
  if ('$decimal' in value)
    return mongoose.mongo.Decimal128.fromString(
      String((value as { $decimal: string }).$decimal)
    );

  return value;
};

let signatureOf = (payload: string, key: Buffer) =>
  createHmac('sha256', key).update(payload).digest('base64url');

// Bound to the canonical query (minus the cursor) so a cursor can't be replayed on another query.
export let encodeCursor = (cursor: RowsCursor, d: { key: Buffer; queryHash: string }) => {
  let payload = Buffer.from(
    JSON.stringify({ v: encodeValue(cursor.value), i: cursor.id, q: d.queryHash })
  ).toString('base64url');

  return `${payload}.${signatureOf(payload, d.key)}`;
};

export let decodeCursor = (
  value: string,
  d: { key: Buffer; queryHash: string }
): RowsCursor => {
  let [payload, signature] = value.split('.');
  if (!payload || !signature) throw new InvalidCursorError('The cursor is malformed.');

  let expected = Buffer.from(signatureOf(payload, d.key));
  let actual = Buffer.from(signature);
  if (expected.length != actual.length || !timingSafeEqual(expected, actual)) {
    throw new InvalidCursorError('The cursor signature is invalid.');
  }

  let parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
    v: unknown;
    i: string;
    q: string;
  };
  if (parsed.q != d.queryHash)
    throw new InvalidCursorError('The cursor belongs to another query.');

  return { value: decodeValue(parsed.v), id: parsed.i };
};

export type RowsSort = { path: string; direction: 'asc' | 'desc' };

export let exportSortOf = (query: BoundQuery): RowsSort => ({
  path: query.dataset.timeField,
  direction: 'asc'
});

export let rowsSortOf = (query: BoundQuery): RowsSort => {
  let order = query.orderBy[0];
  if (!order) return { path: query.dataset.timeField, direction: 'desc' };

  let field = query.dataset.fields[order.by]!;
  return { path: (field.source as { path: string }).path, direction: order.direction };
};

// Keyset continuation: rows strictly after the cursor in (sort value, _id) order, nulls last.
export let cursorPredicate = (sort: RowsSort, cursor: RowsCursor): Predicate => {
  let after: 'lt' | 'gt' = sort.direction == 'desc' ? 'lt' : 'gt';
  let idAfter: Predicate = { t: 'cmp', path: '_id', op: after, value: cursor.id };

  if (cursor.value === null || cursor.value === undefined) {
    return and([{ t: 'null', path: sort.path }, idAfter]);
  }

  return or([
    { t: 'cmp', path: sort.path, op: after, value: cursor.value },
    and([{ t: 'cmp', path: sort.path, op: 'eq', value: cursor.value }, idAfter]),
    { t: 'null', path: sort.path }
  ]);
};

export let projectionPaths = (dataset: DatasetDef, fields: ResolvedField[]) => {
  let paths = new Set<string>([dataset.timeField]);

  for (let field of fields) {
    let source = field.source;
    switch (source.kind) {
      case 'stored':
      case 'array':
      case 'size':
      case 'exists':
        paths.add(source.path);
        break;
      case 'coalesce':
      case 'sum':
        source.paths.forEach(path => paths.add(path));
        break;
      case 'mapped':
        paths.add(source.base);
        if (source.raw) paths.add(source.raw);
        break;
      case 'kind':
      case 'entityAttribute':
        if (dataset.kinds?.kind == 'embedded') paths.add(dataset.kinds.arrayPath);
        if (source.kind == 'entityAttribute' && source.via.kind == 'field') {
          paths.add((dataset.fields[source.via.field]!.source as { path: string }).path);
        }
        break;
      case 'tag':
        if (dataset.tagsPath) paths.add(dataset.tagsPath);
        break;
      case 'sourceKinds':
        sourceKinds.forEach(kind => paths.add(sourceKindPath(kind)));
        break;
    }
  }

  // A parent path makes a child path redundant (and Mongo rejects both in one projection).
  return [...paths].filter(
    path => ![...paths].some(other => other != path && path.startsWith(`${other}.`))
  );
};

export let rowsPipeline = (d: {
  query: BoundQuery;
  scope: EffectiveScope;
  predicate: Predicate;
  cursor?: RowsCursor;
  sort?: RowsSort;
  limit?: number;
}): Stage[] => {
  let sort = d.sort ?? rowsSortOf(d.query);
  let direction = sort.direction == 'desc' ? -1 : 1;
  let predicate = d.cursor ? and([d.predicate, cursorPredicate(sort, d.cursor)]) : d.predicate;
  let projection = Object.fromEntries(
    projectionPaths(d.query.dataset, d.query.select).map(path => [path, 1])
  );

  return [
    ...scan({ dataset: d.query.dataset, scope: d.scope, range: d.query.range, predicate }),
    { $sort: { [sort.path]: direction, _id: direction } },
    { $limit: (d.limit ?? d.query.limit) + 1 },
    { $project: { ...projection, [sort.path]: 1 } }
  ];
};

export let readPath = (document: unknown, path: string): unknown => {
  let current: unknown = document;

  for (let part of path.split('.')) {
    if (Array.isArray(current)) {
      current = current.flatMap(item => {
        let value =
          item && typeof item == 'object'
            ? (item as Record<string, unknown>)[part]
            : undefined;
        return value === undefined ? [] : Array.isArray(value) ? value : [value];
      });
      continue;
    }
    if (!current || typeof current != 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
};

let toNumber = (value: unknown) => {
  if (value === null || value === undefined) return null;
  if (typeof value == 'number') return value;
  if (typeof value == 'object' && 'toString' in value) {
    let parsed = Number(String(value));
    return Number.isFinite(parsed) ? parsed : null;
  }

  let parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

let uniqueStrings = (value: unknown) => [
  ...new Set(
    (Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]).map(
      String
    )
  )
];

export type RowContext = {
  dataset: DatasetDef;
  timeZone: string;
  mapped: MappedContext | null;
  attributes: Map<string, Record<string, unknown>>;
};

export let rowValue = (
  document: Record<string, unknown>,
  field: ResolvedField,
  ctx: RowContext
): unknown => {
  let source = field.source;

  switch (source.kind) {
    case 'stored': {
      let value = readPath(document, source.path);
      if (value instanceof Date) return formatInZone(value, ctx.timeZone);
      if (source.decimal) return toNumber(value);
      return value ?? null;
    }
    case 'array':
      return uniqueStrings(readPath(document, source.path));
    case 'coalesce':
      for (let path of source.paths) {
        let value = toNumber(readPath(document, path));
        if (value !== null) return value;
      }
      return null;
    case 'sum':
      return source.paths.reduce(
        (total, path) => total + (toNumber(readPath(document, path)) ?? 0),
        0
      );
    case 'size': {
      let value = readPath(document, source.path);
      return Array.isArray(value) ? value.length : 0;
    }
    case 'exists': {
      let value = readPath(document, source.path);
      return value !== null && value !== undefined;
    }
    case 'mapped': {
      if (!ctx.mapped) return null;
      let raw = source.raw ? readPath(document, source.raw) : undefined;
      let base = readPath(document, source.base);
      if (field.array) {
        return [
          ...new Set(
            uniqueStrings(base)
              .map(value => mapValue(source, { value, raw: null }, ctx.mapped!))
              .filter((value): value is string => value !== null)
          )
        ];
      }
      return mapValue(
        source,
        {
          value: base === null || base === undefined ? null : String(base),
          raw: raw === null || raw === undefined ? null : String(raw)
        },
        ctx.mapped
      );
    }
    case 'kind': {
      if (ctx.dataset.kinds?.kind != 'embedded') return null;
      let kinds = ctx.dataset.kinds;
      let entries =
        (readPath(document, kinds.arrayPath) as Record<string, unknown>[] | undefined) ?? [];
      let ids = entries
        .filter(entry => entry.kind == source.key && !(Number(entry[kinds.depthKey] ?? 0) > 0))
        .map(entry => String(entry[kinds.idKey]));
      return field.multi ? [...new Set(ids)] : (ids[0] ?? null);
    }
    case 'entityAttribute': {
      let ids: string[];
      if (source.via.kind == 'field') {
        ids = uniqueStrings(
          readPath(
            document,
            (ctx.dataset.fields[source.via.field]!.source as { path: string }).path
          )
        );
      } else {
        ids =
          (rowValue(
            document,
            { ...field, multi: true, source: { kind: 'kind', key: source.key } },
            ctx
          ) as string[]) ?? [];
      }
      let values = ids
        .map(id => ctx.attributes.get(id)?.[source.attribute])
        .filter(value => value !== null && value !== undefined)
        .map(String);
      return values.length ? [...new Set(values)].join(', ') : null;
    }
    case 'tag': {
      let tags =
        (readPath(document, ctx.dataset.tagsPath!) as
          { k: string; v: string }[] | undefined) ?? [];
      let values = tags.filter(tag => tag.k == source.key).map(tag => tag.v);
      return values.length ? values.join(', ') : null;
    }
    case 'cyclic': {
      let time = readPath(document, ctx.dataset.timeField);
      if (!(time instanceof Date)) return null;
      let wall = wallTimeOf(time, ctx.timeZone);
      if (source.unit == 'hourOfDay') return wall.hour;
      let day = new Date(Date.UTC(wall.year, wall.month - 1, wall.day)).getUTCDay();
      return dayNames[(day + 6) % 7] ?? null;
    }
    case 'sourceKinds':
      return sourceKinds.filter(kind => {
        let value = readPath(document, sourceKindPath(kind));
        return value !== null && value !== undefined;
      });
    case 'time':
      return null;
  }
};

export let entityIdsForAttributes = (
  documents: Record<string, unknown>[],
  fields: ResolvedField[],
  ctx: Omit<RowContext, 'attributes'>
) => {
  let ids = new Set<string>();
  let context: RowContext = { ...ctx, attributes: new Map() };

  for (let field of fields) {
    let source = field.source;
    if (source.kind != 'entityAttribute') continue;

    for (let document of documents) {
      let found =
        source.via.kind == 'field'
          ? uniqueStrings(
              readPath(
                document,
                (ctx.dataset.fields[source.via.field]!.source as { path: string }).path
              )
            )
          : ((rowValue(
              document,
              { ...field, multi: true, source: { kind: 'kind', key: source.key } },
              context
            ) as string[]) ?? []);
      found.forEach(id => ids.add(id));
    }
  }

  return [...ids];
};

export let sortValueOf = (document: Record<string, unknown>, sort: RowsSort) => {
  let value = readPath(document, sort.path);
  return value === undefined ? null : value;
};

export let serializeRowsCursor = (cursor: RowsCursor) =>
  JSON.stringify({ v: encodeValue(cursor.value), i: cursor.id });

export let parseRowsCursor = (value: string): RowsCursor => {
  let parsed = JSON.parse(value) as { v: unknown; i: string };
  return { value: decodeValue(parsed.v), id: parsed.i };
};
