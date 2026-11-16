import { createHash } from 'node:crypto';
import type { Catalog, Name, Offering, Pricing } from '@metorial/model-catalog/src/types';
import { tableSpecs, type TableSpec } from './tables';
import type { KnowledgeEntityName } from '@mtsrc/agent-tracking-db';

export type StoredRow = {
  oid: bigint;
  contentHash: string;
  removed: boolean;
  pricingHash?: string | null;
  priced?: boolean;
  vendorModelKey?: string | null;
  firstSeenAt?: string | null;
  reportedFirstSeenAt?: string | null;
  historyFrom?: string | null;
};

export type StoredState = Record<KnowledgeEntityName, Map<string, StoredRow>>;

export type KnowledgeRow = {
  id: string;
  columns: Record<string, unknown>;
  data: Record<string, unknown>;
  contentHash: string;
};

export type EntityDiff = {
  spec: TableSpec;
  rows: Map<string, KnowledgeRow>;
  added: KnowledgeRow[];
  changed: KnowledgeRow[];
  removed: string[];
};

export type HistoryRegressions = {
  firstSeenClamped: { offering: string[]; name: string[] };
  historyLost: string[];
};

export let canonicalJson = (value: unknown): string => {
  if (value === null || typeof value != 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;

  let entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
};

export let hashValue = (value: unknown) =>
  createHash('sha256').update(canonicalJson(value)).digest('base64url');

export let pricingHashOf = (pricing: Pricing | null | undefined) =>
  pricing ? hashValue(pricing) : null;

export let vendorModelKey = (vendorId: unknown, modelId: unknown) =>
  modelId ? `${vendorId}\0${modelId}` : null;

export let emptyStoredState = (): StoredState =>
  Object.fromEntries(tableSpecs.map(spec => [spec.entity, new Map()])) as StoredState;

let earliest = (values: (string | null | undefined)[]) => {
  let times = values.filter((value): value is string => !!value).map(Date.parse);
  return times.length ? Math.min(...times) : null;
};

// Upstream fingerprints ignore lastSeenAt, so storing it would rewrite rows on every publish
// without any content change.
let withoutVolatile = (item: Record<string, unknown>) => {
  let { lastSeenAt: _lastSeenAt, ...rest } = item;
  return rest;
};

// The stored firstSeenAt never moves later. What upstream reported is kept next to it, so a later
// value counts as a regression once, not again on every snapshot after it was accepted.
let clampFirstSeen = (
  data: Record<string, unknown>,
  stored: StoredRow | undefined,
  clamped: string[]
) => {
  let incoming = typeof data.firstSeenAt == 'string' ? Date.parse(data.firstSeenAt) : NaN;
  let known = stored?.firstSeenAt ? Date.parse(stored.firstSeenAt) : NaN;
  if (Number.isNaN(incoming) || Number.isNaN(known) || incoming <= known) return data;

  let reported = stored?.reportedFirstSeenAt ? Date.parse(stored.reportedFirstSeenAt) : known;
  if (incoming > reported) clamped.push(data.id as string);

  return { ...data, firstSeenAt: stored!.firstSeenAt, reportedFirstSeenAt: data.firstSeenAt };
};

export let buildEntityRows = (d: {
  catalog: Catalog;
  stored: StoredState;
}): { diffs: EntityDiff[]; regressions: HistoryRegressions } => {
  let regressions: HistoryRegressions = {
    firstSeenClamped: { offering: [], name: [] },
    historyLost: []
  };

  let diffs = tableSpecs.map(spec => {
    let stored = d.stored[spec.entity];
    let rows = new Map<string, KnowledgeRow>();

    for (let item of spec.items(d.catalog)) {
      if (rows.has(item.id)) continue;

      let previous = stored.get(item.id);
      let data = withoutVolatile(item as unknown as Record<string, unknown>);

      if (spec.entity == 'offering' || spec.entity == 'name') {
        data = clampFirstSeen(data, previous, regressions.firstSeenClamped[spec.entity]);
      }

      if (spec.entity == 'name' && previous?.historyFrom) {
        let incomingFrom = earliest(
          (data as unknown as Name).history?.map(period => period.from)
        );
        if (incomingFrom === null || incomingFrom > Date.parse(previous.historyFrom)) {
          regressions.historyLost.push(item.id);
        }
      }

      let columns = spec.promote(data);

      if (spec.entity == 'offering') {
        let pricing = (data as unknown as Offering).pricing;
        columns.pricingHash = pricingHashOf(pricing) ?? previous?.pricingHash ?? null;
      }

      rows.set(item.id, { id: item.id, columns, data, contentHash: hashValue(data) });
    }

    let added: KnowledgeRow[] = [];
    let changed: KnowledgeRow[] = [];

    for (let row of rows.values()) {
      let previous = stored.get(row.id);

      if (!previous) added.push(row);
      else if (previous.removed || previous.contentHash != row.contentHash) changed.push(row);
    }

    let removed = [...stored.entries()]
      .filter(([id, row]) => !row.removed && !rows.has(id))
      .map(([id]) => id);

    return { spec, rows, added, changed, removed };
  });

  return { diffs, regressions };
};
