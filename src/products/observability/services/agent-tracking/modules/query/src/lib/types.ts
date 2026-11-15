import type {
  DerivedFormat,
  Expr,
  Filter,
  FilterOp,
  FilterValue,
  Query,
  QueryError
} from '@mtsrc/agent-tracking-query-spec';
import type { DatasetDef, FieldType, ResolvedField } from '../catalog';

export type TimeRange = { from: Date; to: Date };

export type BoundLeaf = {
  field: ResolvedField;
  op: FilterOp;
  value?: FilterValue | FilterValue[];
  pointer: string;
};

export type BoundFilter =
  { and: BoundFilter[] } | { or: BoundFilter[] } | { not: BoundFilter } | { leaf: BoundLeaf };

export type BoundDimension = {
  name: string;
  field: ResolvedField;
  bins?: number[];
  level: number | 'all';
  missing: 'null' | 'exclude';
};

export type AccumulatorFn =
  'sum' | 'avg' | 'min' | 'max' | 'count' | 'countDistinct' | 'percentile';

export type AggregateMeasure = {
  kind: 'aggregate';
  name: string;
  hidden: boolean;
  fn: AccumulatorFn;
  q?: number;
  field?: ResolvedField;
  where?: BoundFilter;
  type: FieldType;
};

export type BoundMeasure =
  | AggregateMeasure
  | {
      kind: 'composite';
      name: string;
      hidden: boolean;
      parts: Record<string, string>;
      total: boolean;
    }
  | { kind: 'reported'; name: string; hidden: boolean; path: string; where?: BoundFilter }
  | { kind: 'derived'; name: string; hidden: boolean; expr: Expr; format?: DerivedFormat };

export type QueryWarning = { code: string; message: string };

export type PrivacySettings = { hideIndividuals: boolean; minGroupUsers: number };

export type BoundQuery = {
  canonical: Query;
  dataset: DatasetDef;
  mode: 'aggregate' | 'rows';
  range: TimeRange;
  timeZone: string;
  now: Date;
  where?: BoundFilter;
  dimensions: BoundDimension[];
  measures: BoundMeasure[];
  having?: Filter;
  orderBy: { by: string; direction: 'asc' | 'desc' }[];
  limit: number;
  allocation: 'full' | 'split';
  compare?: TimeRange;
  totals: boolean;
  other: boolean;
  fill: { time?: 'zero' | 'null'; groups: boolean };
  labels: boolean;
  strict: boolean;
  select: ResolvedField[];
  cursor?: string;
  privacy: PrivacySettings;
  warnings: QueryWarning[];
};

export class QueryBindError extends Error {
  constructor(readonly errors: QueryError[]) {
    super(errors.map(error => `${error.pointer}: ${error.message}`).join('\n'));
  }
}

export let isAdditive = (measure: BoundMeasure) =>
  measure.kind == 'composite' ||
  measure.kind == 'reported' ||
  (measure.kind == 'aggregate' && (measure.fn == 'sum' || measure.fn == 'count'));
