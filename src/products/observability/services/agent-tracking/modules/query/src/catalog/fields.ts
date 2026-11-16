import { billingModes, billingSources } from '@mtsrc/agent-tracking-spec';
import { timeUnits } from '@mtsrc/agent-tracking-query-spec';
import type { FieldDef, FieldType, MappedResolverName } from './types';

export let outcomes = ['ok', 'error', 'cancelled', 'timeout', 'refused', 'blocked'] as const;

export let errorClasses = [
  'auth',
  'rate_limit',
  'overloaded',
  'invalid_request',
  'context_length',
  'network',
  'timeout',
  'server',
  'tool',
  'permission',
  'internal',
  'unknown'
] as const;

export let toolKinds = [
  'builtin',
  'mcp',
  'extension',
  'shell',
  'agent',
  'skill',
  'unknown'
] as const;

export let toolClasses = [
  'shell',
  'file_read',
  'file_write',
  'file_edit',
  'search',
  'web',
  'mcp',
  'agent',
  'other'
] as const;

export let vendorSources = [
  'reported',
  'endpoint',
  'offering',
  'agent',
  'first-party'
] as const;

export let dayNames = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
] as const;

type FieldInput = Partial<FieldDef> & Pick<FieldDef, 'type' | 'source' | 'description'>;

export let field = (d: FieldInput): FieldDef => ({
  dimension: true,
  measure: false,
  filter: true,
  select: true,
  sensitivity: 'normal',
  cardinality: 'medium',
  ...d
});

export let stored = (
  path: string,
  type: FieldType,
  description: string,
  extra: Partial<FieldDef> = {}
) => field({ type, source: { kind: 'stored', path }, description, ...extra });

export let enumField = (
  path: string,
  values: readonly string[],
  description: string,
  extra: Partial<FieldDef> = {}
) =>
  field({
    type: 'enum',
    source: { kind: 'stored', path },
    enumValues: values,
    cardinality: 'low',
    description,
    ...extra
  });

export let boolField = (path: string, description: string) =>
  field({ type: 'bool', source: { kind: 'stored', path }, cardinality: 'low', description });

export let arrayField = (
  path: string,
  type: FieldType,
  description: string,
  extra: Partial<FieldDef> = {}
) =>
  field({
    type,
    source: { kind: 'array', path },
    array: true,
    multi: true,
    description,
    ...extra
  });

export let measureField = (
  source: FieldDef['source'],
  type: FieldType,
  description: string,
  extra: Partial<FieldDef> = {}
) =>
  field({
    type,
    source,
    description,
    dimension: false,
    measure: true,
    filter: source.kind == 'stored',
    percentile: true,
    cardinality: 'high',
    ...extra
  });

export let storedMeasure = (
  path: string,
  type: FieldType,
  description: string,
  extra: Partial<FieldDef> = {}
) =>
  measureField(
    { kind: 'stored', path, ...(type == 'money' ? { decimal: true } : {}) },
    type,
    description,
    extra
  );

let mapped = (
  resolver: MappedResolverName,
  base: string,
  type: FieldType,
  description: string,
  extra: Partial<FieldDef> = {}
) => field({ type, source: { kind: 'mapped', resolver, base }, description, ...extra });

export type CommonPaths = {
  project: string;
  instance: string;
  user: string;
  device: string;
  agentId: string;
  clientFamily: string;
  clientSurface?: string;
  clientVersion: string;
  clientVersionKey: string;
  session: string;
  model?: string;
  modelArray?: boolean;
  modelRaw?: string;
  modelRawArray?: boolean;
  modelFromRaw?: string;
  repo: { path: string; array: boolean };
  workspace: { path: string; array: boolean };
};

export let commonFields = (paths: CommonPaths): Record<string, FieldDef> => {
  let fields: Record<string, FieldDef> = {
    'metorial.project': stored(paths.project, 'id', 'The Metorial project.', {
      label: 'project',
      cardinality: 'low'
    }),
    'metorial.instance': stored(paths.instance, 'id', 'The Metorial instance.', {
      label: 'instance',
      cardinality: 'low'
    }),
    user: stored(paths.user, 'id', 'The user entity.', {
      sensitivity: 'personal',
      cardinality: 'high',
      label: 'entity',
      entityKind: 'user',
      distinct: true
    }),
    device: stored(paths.device, 'id', 'The device entity.', {
      sensitivity: 'personal',
      cardinality: 'high',
      label: 'entity',
      entityKind: 'device',
      distinct: true
    }),
    agentId: stored(
      paths.agentId,
      'id',
      'The agent entity (a configured or discovered agent).',
      {
        label: 'entity',
        entityKind: 'agent',
        distinct: true
      }
    ),
    agent: mapped(
      'agent',
      paths.clientFamily,
      'id',
      'The catalog agent, from the client family.',
      {
        label: 'agent'
      }
    ),
    'agent.maker': mapped(
      'agent.maker',
      paths.clientFamily,
      'id',
      'The organization that makes the agent.',
      {
        label: 'maker',
        cardinality: 'low'
      }
    ),
    'client.family': stored(paths.clientFamily, 'string', 'The client family as reported.', {
      cardinality: 'low'
    }),
    'client.version': field({
      type: 'version',
      source: {
        kind: 'stored',
        path: paths.clientVersion,
        versionKeyPath: paths.clientVersionKey
      },
      searchable: true,
      description: 'The client version. Ordered comparisons follow semver.'
    }),
    session: stored(paths.session, 'id', 'The session.', {
      sensitivity: 'personal',
      cardinality: 'high',
      dimension: false,
      distinct: true
    }),
    repo: paths.repo.array
      ? arrayField(paths.repo.path, 'id', 'Repository entities.', {
          label: 'entity',
          entityKind: 'repo',
          cardinality: 'high',
          distinct: true
        })
      : stored(paths.repo.path, 'id', 'The repository entity.', {
          label: 'entity',
          entityKind: 'repo',
          cardinality: 'high',
          distinct: true
        }),
    workspace: paths.workspace.array
      ? arrayField(paths.workspace.path, 'id', 'Workspace entities.', {
          label: 'entity',
          entityKind: 'workspace',
          cardinality: 'high',
          distinct: true
        })
      : stored(paths.workspace.path, 'id', 'The workspace entity.', {
          label: 'entity',
          entityKind: 'workspace',
          cardinality: 'high',
          distinct: true
        })
  };

  if (paths.clientSurface) {
    fields['client.surface'] = stored(paths.clientSurface, 'string', 'The client surface.', {
      cardinality: 'low'
    });
  }

  let modelBase = paths.model ?? paths.modelFromRaw;
  let array = paths.modelArray ? { array: true, multi: true } : {};

  if (paths.model) {
    fields.model = paths.modelArray
      ? arrayField(paths.model, 'id', 'Canonical models.', { label: 'model', distinct: true })
      : stored(paths.model, 'id', 'The canonical model.', { label: 'model', distinct: true });
  } else if (paths.modelFromRaw) {
    fields.model = mapped(
      'model.fromRaw',
      paths.modelFromRaw,
      'id',
      'The canonical model, resolved from the raw model name.',
      {
        label: 'model'
      }
    );
  }

  if (paths.modelRaw) {
    fields['model.raw'] = paths.modelRawArray
      ? arrayField(paths.modelRaw, 'string', 'Raw model names as reported.', {
          searchable: true
        })
      : stored(paths.modelRaw, 'string', 'The raw model name as reported.', {
          searchable: true
        });
  }

  if (modelBase) {
    let attributes: [MappedResolverName, FieldType, string, Partial<FieldDef>][] = [
      ['model.family', 'id', 'The model family.', { label: 'family' }],
      [
        'model.lab',
        'id',
        'The lab that made the model.',
        { label: 'lab', cardinality: 'low' }
      ],
      ['model.kind', 'enum', 'The model kind.', { cardinality: 'low' }],
      ['model.status', 'enum', 'The model lifecycle status.', { cardinality: 'low' }],
      [
        'model.isLatest',
        'bool',
        'Whether the model is its family’s latest.',
        { cardinality: 'low' }
      ],
      [
        'model.openWeights',
        'bool',
        'Whether the model has open weights.',
        { cardinality: 'low' }
      ]
    ];

    for (let [name, type, description, extra] of attributes) {
      let raw = name == 'model.lab' && paths.modelRaw && !paths.modelRawArray;

      fields[name] = field({
        type,
        source: {
          kind: 'mapped',
          resolver: name,
          base: modelBase,
          ...(raw ? { raw: paths.modelRaw } : {}),
          ...(paths.model ? {} : { fromRaw: true })
        },
        description,
        ...array,
        ...extra
      });
    }
  }

  return fields;
};

export let billingFields = (paths: {
  vendor: string;
  vendorSource?: string;
  mode: string;
  source: string;
  plan: string;
  array?: boolean;
}): Record<string, FieldDef> => {
  let array = paths.array ? { array: true, multi: true } : {};
  let sourceOf = (path: string) =>
    paths.array ? { kind: 'array' as const, path } : { kind: 'stored' as const, path };

  let fields: Record<string, FieldDef> = {
    vendor: field({
      type: 'id',
      source: sourceOf(paths.vendor),
      label: 'vendor',
      description: 'The vendor that served the model.',
      ...array
    }),
    'vendor.kind': field({
      type: 'enum',
      source: { kind: 'mapped', resolver: 'vendor.kind', base: paths.vendor },
      cardinality: 'low',
      description: 'The kind of vendor.',
      ...array
    }),
    'billing.mode': field({
      type: 'enum',
      source: sourceOf(paths.mode),
      enumValues: billingModes,
      cardinality: 'low',
      description: 'How the usage was billed.',
      ...array
    }),
    'billing.source': field({
      type: 'enum',
      source: sourceOf(paths.source),
      enumValues: billingSources,
      cardinality: 'low',
      description: 'How the billing mode was determined.',
      ...array
    }),
    'billing.plan': field({
      type: 'string',
      source: sourceOf(paths.plan),
      searchable: true,
      cardinality: 'low',
      description: 'The billing plan as reported.',
      ...array
    })
  };

  if (paths.vendorSource) {
    fields['vendor.source'] = field({
      type: 'enum',
      source: sourceOf(paths.vendorSource),
      enumValues: vendorSources,
      cardinality: 'low',
      description: 'How the vendor was resolved.',
      ...array
    });
  }

  return fields;
};

export let timeFields = (): Record<string, FieldDef> => {
  let fields: Record<string, FieldDef> = {};

  for (let unit of timeUnits) {
    fields[`time.${unit}`] = field({
      type: 'date',
      source: { kind: 'time', unit },
      filter: false,
      select: false,
      cardinality: unit == 'hour' || unit == 'day' ? 'high' : 'medium',
      description: `The ${unit} the data falls in, in the query’s time zone.`
    });
  }

  fields['time.hourOfDay'] = field({
    type: 'number',
    source: { kind: 'cyclic', unit: 'hourOfDay' },
    select: false,
    cardinality: 'low',
    description: 'The hour of day (0–23) in the query’s time zone.'
  });
  fields['time.dayOfWeek'] = field({
    type: 'enum',
    source: { kind: 'cyclic', unit: 'dayOfWeek' },
    enumValues: dayNames,
    select: false,
    cardinality: 'low',
    description: 'The day of week in the query’s time zone.'
  });

  return fields;
};

export let tokenPaths = (prefix: string) => ({
  input: `${prefix}.inputUncached`,
  cacheRead: `${prefix}.cacheRead`,
  cacheWrite: `${prefix}.cacheWrite`,
  output: `${prefix}.output`,
  reasoning: `${prefix}.reasoning`
});

export let tokenFields = (prefix: string): Record<string, FieldDef> => {
  let paths = tokenPaths(prefix);

  return {
    'tokens.input': storedMeasure(paths.input, 'number', 'Uncached input tokens.'),
    'tokens.cacheRead': storedMeasure(
      paths.cacheRead,
      'number',
      'Tokens read from the cache.'
    ),
    'tokens.cacheWrite': storedMeasure(
      paths.cacheWrite,
      'number',
      'Tokens written to the cache.'
    ),
    'tokens.output': storedMeasure(paths.output, 'number', 'Output tokens.'),
    'tokens.reasoning': storedMeasure(paths.reasoning, 'number', 'Reasoning tokens.'),
    'tokens.total': measureField(
      { kind: 'sum', paths: Object.values(paths) },
      'number',
      'All tokens.'
    )
  };
};
