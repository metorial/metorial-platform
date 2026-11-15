import type {
  DatasetName,
  DerivedFormat,
  Expr,
  Filter,
  TimeUnit
} from '@mtsrc/agent-tracking-query-spec';

export type FieldType =
  'id' | 'string' | 'enum' | 'number' | 'money' | 'duration' | 'date' | 'bool' | 'version';

export type Cardinality = 'low' | 'medium' | 'high';

export type Sensitivity = 'normal' | 'personal';

export type MappedResolverName =
  | 'model.family'
  | 'model.lab'
  | 'model.kind'
  | 'model.status'
  | 'model.isLatest'
  | 'model.openWeights'
  | 'vendor.kind'
  | 'agent'
  | 'agent.maker'
  | 'model.fromRaw';

export type LabelSource =
  | 'entity'
  | 'model'
  | 'family'
  | 'lab'
  | 'vendor'
  | 'agent'
  | 'maker'
  | 'project'
  | 'instance';

export type FieldSource =
  | { kind: 'stored'; path: string; versionKeyPath?: string; decimal?: boolean }
  | { kind: 'coalesce'; paths: string[] }
  | { kind: 'sum'; paths: string[] }
  | { kind: 'size'; path: string }
  | { kind: 'array'; path: string }
  | { kind: 'exists'; path: string }
  | {
      kind: 'mapped';
      resolver: MappedResolverName;
      base: string;
      raw?: string;
      fromRaw?: boolean;
    }
  | { kind: 'kind'; key: string }
  | { kind: 'entityAttribute'; key: string; attribute: string; via: EntityVia }
  | { kind: 'tag'; key: string }
  | { kind: 'time'; unit: TimeUnit }
  | { kind: 'cyclic'; unit: 'hourOfDay' | 'dayOfWeek' }
  | { kind: 'sourceKinds' };

// How an entity attribute reaches the documents: through attribution kinds, or a stored entity id.
export type EntityVia = { kind: 'kind' } | { kind: 'field'; field: string };

export type FieldDef = {
  type: FieldType;
  source: FieldSource;
  dimension: boolean;
  measure: boolean;
  filter: boolean;
  select: boolean;
  array?: boolean;
  sensitivity: Sensitivity;
  cardinality: Cardinality;
  searchable?: boolean;
  distinct?: boolean;
  percentile?: boolean;
  enumValues?: readonly string[];
  label?: LabelSource;
  entityKind?: string;
  multi?: boolean;
  description: string;
};

export type ResolvedField = FieldDef & { name: string };

export type MetricFn = 'sum' | 'count' | 'countDistinct' | 'min' | 'max' | 'avg';

export type MetricDef =
  | {
      kind: 'aggregate';
      fn: MetricFn;
      field?: string;
      where?: Filter;
      type: FieldType;
      description: string;
    }
  | { kind: 'derived'; expr: Expr; format: DerivedFormat; description: string }
  | { kind: 'composite'; parts: Record<string, string>; total: boolean; description: string }
  | { kind: 'reported'; path: string; description: string };

export type KindsConfig =
  | {
      kind: 'embedded';
      arrayPath: string;
      idsPath: string;
      idKey: string;
      weightKey: string;
      depthKey: string;
    }
  | { kind: 'semiJoin'; sessionKeyPath: string };

export type IndexDef = { name: string; keys: string[] };

export type DatasetDef = {
  name: DatasetName;
  collection: 'usageSlices' | 'sessions' | 'events' | 'sourceHealth';
  description: string;
  baseMatch?: Record<string, unknown>;
  timeField: string;
  maxRangeDays: number;
  maxHourlyRangeDays: number;
  retentionDays?: number;
  scopePaths: { project?: string; instance: string };
  kinds: KindsConfig | null;
  tagsPath?: string;
  dailyBuckets?: { minutesPath: string };
  countable: boolean;
  rows: boolean;
  fields: Record<string, FieldDef>;
  metrics: Record<string, MetricDef>;
  indexes: IndexDef[];
};
