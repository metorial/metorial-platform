export let queryLanguageVersion = '0';

export let datasetNames = ['usage', 'sessions', 'requests', 'tool_calls', 'sources'] as const;

export type DatasetName = (typeof datasetNames)[number];

export let queryModes = ['aggregate', 'rows'] as const;

export type QueryMode = (typeof queryModes)[number];

export let rangePresets = [
  'today',
  'yesterday',
  'this_week',
  'last_week',
  'this_month',
  'last_month',
  'this_quarter',
  'last_quarter',
  'this_year'
] as const;

export type RangePreset = (typeof rangePresets)[number];

export type Range = { from: string; to: string } | { last: string } | { preset: RangePreset };

export let filterOps = [
  'eq',
  'neq',
  'in',
  'notIn',
  'isNull',
  'notNull',
  'gt',
  'gte',
  'lt',
  'lte',
  'between',
  'contains',
  'startsWith',
  'any',
  'all',
  'none'
] as const;

export type FilterOp = (typeof filterOps)[number];

export type FilterValue = string | number | boolean;

export type FilterLeaf = { field: string; op: FilterOp; value?: FilterValue | FilterValue[] };

export type Filter = { and: Filter[] } | { or: Filter[] } | { not: Filter } | FilterLeaf;

export type DimensionSpec = {
  field: string;
  as?: string;
  bins?: number[];
  level?: number | 'all';
  missing?: 'null' | 'exclude';
};

export type Dimension = string | DimensionSpec;

export let aggregateFns = [
  'sum',
  'avg',
  'min',
  'max',
  'count',
  'countDistinct',
  'p50',
  'p75',
  'p90',
  'p95',
  'p99',
  'percentile'
] as const;

export type AggregateFn = (typeof aggregateFns)[number];

export type MeasureSpec = {
  fn: AggregateFn;
  field?: string;
  q?: number;
  where?: Filter;
  as?: string;
};

export type Measure = string | MeasureSpec;

export type Expr =
  | number
  | string
  | { add: Expr[] }
  | { sub: [Expr, Expr] }
  | { mul: Expr[] }
  | { div: [Expr, Expr] }
  | { min: Expr[] }
  | { max: Expr[] }
  | { abs: Expr }
  | { round: [Expr, number] }
  | { coalesce: Expr[] }
  | { shareOfTotal: string }
  | { shareWithin: [string, string] }
  | { cumulative: string }
  | { movingAvg: [string, number] }
  | { rank: string };

export let derivedFormats = ['number', 'money', 'percent', 'duration'] as const;

export type DerivedFormat = (typeof derivedFormats)[number];

export type Derived = { as: string; expr: Expr; format?: DerivedFormat };

export type OrderBy = { by: string; direction?: 'asc' | 'desc' };

export type Compare = { previous: 'period' } | { previous: 'year' } | { range: Range };

export type Fill = { time?: 'zero' | 'null'; groups?: boolean };

export type Query = {
  atq: typeof queryLanguageVersion;
  dataset: DatasetName;
  mode?: QueryMode;

  range: Range;
  timeZone?: string;

  where?: Filter;
  dimensions?: Dimension[];
  measures?: Measure[];
  derived?: Derived[];
  having?: Filter;

  select?: string[];
  orderBy?: OrderBy[];
  limit?: number;
  cursor?: string;

  allocation?: 'full' | 'split';
  compare?: Compare;
  totals?: boolean;
  other?: boolean;
  fill?: Fill;
  labels?: boolean;
  strict?: boolean;
};

export type QueryError = {
  code: string;
  message: string;
  pointer: string;
};

export let queryLimits = {
  dimensions: 5,
  highCardinalityDimensions: 2,
  measures: 20,
  derived: 20,
  measuresAndDerived: 40,
  orderBy: 3,
  filterDepth: 6,
  filterLeaves: 100,
  listValues: 1000,
  bins: 50,
  defaultLimit: 1000,
  maxLimit: 10_000,
  maxRowsLimit: 500,
  select: 50
} as const;
