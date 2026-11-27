import type {
  DashboardInstanceAgentTrackingMembersInsightsQuery,
  DashboardInstanceAgentTrackingViewsCreateBody
} from '@metorial/dashboard-sdk';
import { useMemo } from 'react';
import { fractionToPercent, percentToFraction, toDollars, toMicros } from '../costFormat';
import { agentTrackingRangePresets, type AgentTrackingRangePreset } from '../range';
import { useLatestSearchParams } from '../searchParams';
import {
  defaultTeamViewKind,
  isTeamViewKind,
  teamViewDefinitions,
  type InsightsSort,
  type SortOrder,
  type TeamViewField,
  type TeamViewKind,
  type TeamViewParams,
  type TeamViewState
} from './definitions';

let teamViewSearchKeys = {
  kind: 'view',
  saved: 'saved',
  range: 'range',
  sort: 'sort',
  order: 'order',
  includeInactive: 'inactive',
  modelIds: 'modelId',
  seats: 'seat',
  modelShareMin: 'modelShare',
  highEffortShareMin: 'highEffort',
  fastShareMin: 'fastMode',
  outdatedShareMin: 'outdated',
  cacheHitRateMax: 'cacheHit',
  seatUsageMaxMicros: 'usageBelow',
  flaggedOnly: 'flagged'
} as const;

let insightsPageSize = 50;

// data-hooks writes these cursor keys but does not export them.
let paginationKeys = ['before', 'after'];

let savedViewIdPattern = /^[A-Za-z0-9_-]{1,64}$/;

let shareFields = [
  'modelShareMin',
  'highEffortShareMin',
  'fastShareMin',
  'outdatedShareMin',
  'cacheHitRateMax'
] as const;

let booleanFields = ['includeInactive', 'flaggedOnly'] as const;

type ShareField = (typeof shareFields)[number];

type BooleanField = (typeof booleanFields)[number];

type SavedViewParams = DashboardInstanceAgentTrackingViewsCreateBody['params'];

export type InsightsQuery = DashboardInstanceAgentTrackingMembersInsightsQuery;

export type ApplyTeamView = (
  view: TeamViewState,
  savedId: string | null,
  opts?: { push?: boolean }
) => void;

let isShareField = (field: TeamViewField): field is ShareField =>
  (shareFields as readonly string[]).includes(field);

let isBooleanField = (field: TeamViewField): field is BooleanField =>
  (booleanFields as readonly string[]).includes(field);

let isRange = (value: unknown): value is AgentTrackingRangePreset =>
  agentTrackingRangePresets.some(preset => preset.id == value);

let isOrder = (value: unknown): value is SortOrder => value == 'asc' || value == 'desc';

let isSortOf = (kind: TeamViewKind, value: unknown): value is InsightsSort =>
  teamViewDefinitions[kind].sorts.some(sort => sort.id == value);

let isFieldValue = (kind: TeamViewKind, field: TeamViewField, value: unknown) => {
  if (field == 'range') return isRange(value);
  if (field == 'sort') return isSortOf(kind, value);
  if (field == 'order') return isOrder(value);
  if (field == 'modelIds' || field == 'seats') {
    return Array.isArray(value) && value.every(item => typeof item == 'string');
  }
  if (isBooleanField(field)) return typeof value == 'boolean';

  return typeof value == 'number' && Number.isFinite(value);
};

let readFields = (kind: TeamViewKind, read: (field: TeamViewField) => unknown) => {
  let params: Record<string, unknown> = {};

  for (let field of teamViewDefinitions[kind].fields) {
    let value = read(field);
    if (isFieldValue(kind, field, value)) params[field] = value;
  }

  return params as TeamViewParams;
};

let parseBoolean = (raw: string) =>
  raw == '1' || raw == 'true' ? true : raw == '0' || raw == 'false' ? false : undefined;

let fromSearch = (field: TeamViewField, raw: string): unknown => {
  if (field == 'modelIds' || field == 'seats') {
    return [...new Set(raw.split(',').map(value => value.trim()))].filter(Boolean);
  }
  if (isBooleanField(field)) return parseBoolean(raw);
  if (!raw.trim()) return undefined;
  if (field == 'seatUsageMaxMicros') return toMicros(Number(raw));
  if (isShareField(field)) return percentToFraction(Number(raw));

  return raw;
};

let sameList = (a: string[] = [], b: string[] = []) => {
  if (a.length != b.length) return false;
  let sortedB = [...b].sort();
  return [...a].sort().every((value, index) => value == sortedB[index]);
};

export let resolveTeamView = (kind: TeamViewKind, params: TeamViewParams): TeamViewState => {
  let definition = teamViewDefinitions[kind];
  let resolved: TeamViewParams = {};

  for (let field of definition.fields) {
    let value = params[field] ?? definition.defaults[field];
    if (value !== undefined) (resolved as Record<string, unknown>)[field] = value;
  }

  return { kind, params: resolved };
};

export let defaultTeamView = (kind: TeamViewKind = defaultTeamViewKind) =>
  resolveTeamView(kind, {});

export let parseTeamViewSearch = (search: URLSearchParams) => {
  let rawKind = search.get(teamViewSearchKeys.kind);
  let kind = isTeamViewKind(rawKind) ? rawKind : defaultTeamViewKind;
  let rawSaved = search.get(teamViewSearchKeys.saved);

  let params = readFields(kind, field => {
    let raw = search.get(teamViewSearchKeys[field]);
    return raw === null ? undefined : fromSearch(field, raw);
  });

  return {
    state: resolveTeamView(kind, params),
    savedId: rawSaved && savedViewIdPattern.test(rawSaved) ? rawSaved : null
  };
};

let searchValueOf = (field: TeamViewField, value: TeamViewParams[TeamViewField]) => {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.length ? value.join(',') : undefined;
  if (typeof value == 'boolean') return value ? '1' : '0';
  if (field == 'seatUsageMaxMicros') return String(toDollars(value as number));
  if (isShareField(field)) return String(fractionToPercent(value as number));

  return String(value);
};

let sameValue = (
  a: TeamViewParams[TeamViewField] | undefined,
  b: TeamViewParams[TeamViewField] | undefined
) => (Array.isArray(a) || Array.isArray(b) ? sameList(a as string[], b as string[]) : a === b);

export let writeTeamViewSearch = (
  current: URLSearchParams,
  view: TeamViewState,
  savedId: string | null
) => {
  let next = new URLSearchParams(current);
  for (let key of [...Object.values(teamViewSearchKeys), ...paginationKeys]) next.delete(key);

  let resolved = resolveTeamView(view.kind, view.params);
  let defaults = defaultTeamView(view.kind).params;

  if (view.kind != defaultTeamViewKind || savedId)
    next.set(teamViewSearchKeys.kind, view.kind);
  if (savedId) next.set(teamViewSearchKeys.saved, savedId);

  for (let field of teamViewDefinitions[view.kind].fields) {
    let value = resolved.params[field];
    if (sameValue(value, defaults[field])) continue;

    let searchValue = searchValueOf(field, value);
    if (searchValue !== undefined) next.set(teamViewSearchKeys[field], searchValue);
  }

  return next;
};

export let isSameTeamView = (a: TeamViewState, b: TeamViewState) => {
  if (a.kind != b.kind) return false;

  let left = resolveTeamView(a.kind, a.params).params;
  let right = resolveTeamView(b.kind, b.params).params;

  return teamViewDefinitions[a.kind].fields.every(field =>
    sameValue(left[field], right[field])
  );
};

export let patchTeamViewSearch = (search: URLSearchParams, patch: TeamViewParams) => {
  let { state, savedId } = parseTeamViewSearch(search);
  return writeTeamViewSearch(
    search,
    { kind: state.kind, params: { ...state.params, ...patch } },
    savedId
  );
};

export let sortPatch = (view: TeamViewState, sort: InsightsSort): TeamViewParams => {
  let { defaults, sorts } = teamViewDefinitions[view.kind];
  if (view.params.sort == sort) return { order: view.params.order == 'asc' ? 'desc' : 'asc' };

  let first =
    sort == defaults.sort ? defaults.order : sorts.find(item => item.id == sort)?.order;
  return { sort, order: first ?? 'desc' };
};

export let useTeamViewSearch = () => {
  let { params, read, write } = useLatestSearchParams();
  let parsed = useMemo(() => parseTeamViewSearch(params), [params]);

  let apply: ApplyTeamView = (view, savedId, opts) =>
    write(writeTeamViewSearch(read(), view, savedId), opts);

  let patch = (next: TeamViewParams) => write(patchTeamViewSearch(read(), next));

  let current = () => parseTeamViewSearch(read());

  return { ...parsed, apply, patch, current };
};

export let canSaveTeamView = (view: TeamViewState) =>
  view.kind != 'by_model' || !!view.params.modelIds?.length;

export let toInsightsQuery = (view: TeamViewState, timeZone: string): InsightsQuery | null => {
  if (view.kind == 'recent' || !canSaveTeamView(view)) return null;

  let definition = teamViewDefinitions[view.kind];
  let { params } = resolveTeamView(view.kind, view.params);
  let query: InsightsQuery = {
    limit: insightsPageSize,
    range: params.range,
    timeZone,
    include: definition.include,
    sort: params.sort,
    order: params.order
  };

  if (params.includeInactive) query.includeInactive = true;
  if (params.flaggedOnly) query.flaggedOnly = true;
  if (params.modelIds?.length) query.modelId = params.modelIds;
  if (params.seats?.length) query.seat = params.seats;

  for (let field of shareFields) {
    if (params[field] !== undefined) query[field] = params[field];
  }
  if (params.seatUsageMaxMicros !== undefined) {
    query.seatUsageMaxMicros = params.seatUsageMaxMicros;
  }

  return query;
};

export let toSavedViewParams = (view: TeamViewState): SavedViewParams => {
  let { params } = resolveTeamView(view.kind, view.params);
  let saved: Record<string, unknown> = { version: 1 };

  for (let [field, value] of Object.entries(params)) {
    if (Array.isArray(value) && !value.length) continue;
    saved[field] = value;
  }

  return saved as SavedViewParams;
};

export let teamViewHref = (teamPath: string, view: TeamViewState, savedId: string | null) => {
  let search = writeTeamViewSearch(new URLSearchParams(), view, savedId).toString();
  return search ? `${teamPath}?${search}` : teamPath;
};

let withoutTrailingSlash = (path: string) => path.replace(/\/+$/, '');

export let isTeamPath = (pathname: string, teamPath: string) =>
  withoutTrailingSlash(pathname) == withoutTrailingSlash(teamPath);

export let activeTeamViewKind = (
  location: { pathname: string; search: string },
  teamPath: string
) => {
  if (!isTeamPath(location.pathname, teamPath)) return null;

  let { state, savedId } = parseTeamViewSearch(new URLSearchParams(location.search));
  return savedId ? null : state.kind;
};

export let fromSavedView = (view: { kind: string; params: unknown }) => {
  let raw = (view.params ?? {}) as Record<string, unknown>;
  if (!isTeamViewKind(view.kind) || (raw.version !== 1 && raw.version !== '1')) return null;

  return resolveTeamView(
    view.kind,
    readFields(view.kind, field => raw[field])
  );
};
