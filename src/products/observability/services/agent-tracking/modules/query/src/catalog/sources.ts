import { field, stored, storedMeasure, timeFields } from './fields';
import { count, distinct } from './metrics';
import type { DatasetDef } from './types';

export let sourceKinds = [
  'hook',
  'probe',
  'otel.logs',
  'otel.spans',
  'otel.metrics',
  'plugin',
  'transcript',
  'vendor'
] as const;

export let sourcesDataset: DatasetDef = {
  name: 'sources',
  collection: 'sourceHealth',
  description: 'Which devices send which kinds of telemetry, per instance and client family.',
  timeField: 'updatedAt',
  maxRangeDays: 30,
  maxHourlyRangeDays: 30,
  scopePaths: { instance: 'instanceId' },
  kinds: null,
  countable: true,
  rows: false,
  fields: {
    'metorial.instance': stored('instanceId', 'id', 'The Metorial instance.', {
      label: 'instance',
      cardinality: 'low'
    }),
    device: stored('deviceId', 'id', 'The device entity.', {
      sensitivity: 'personal',
      cardinality: 'high',
      label: 'entity',
      entityKind: 'device',
      distinct: true
    }),
    user: stored('userId', 'id', 'The user entity.', {
      sensitivity: 'personal',
      cardinality: 'high',
      label: 'entity',
      entityKind: 'user',
      distinct: true
    }),
    'client.family': stored('family', 'string', 'The client family.', { cardinality: 'low' }),
    'client.version': stored('clientVersion', 'string', 'The client version.', {
      searchable: true
    }),
    'probe.version': stored('probeVersion', 'string', 'The probe version.', {
      searchable: true,
      cardinality: 'low'
    }),
    'source.kind': field({
      type: 'enum',
      source: { kind: 'sourceKinds' },
      enumValues: sourceKinds,
      array: true,
      multi: true,
      cardinality: 'low',
      description: 'The kinds of telemetry the source has sent.'
    }),
    ...timeFields(),
    lastSeen: storedMeasure('updatedAt', 'date', 'When the source was last seen.', {
      percentile: false
    })
  },
  metrics: {
    sources: count('Sources.'),
    devices: distinct('device', 'Distinct devices.'),
    'users.active': distinct('user', 'Distinct users.'),
    lastSeen: {
      kind: 'aggregate',
      fn: 'max',
      field: 'lastSeen',
      type: 'date',
      description: 'When any source in the group was last seen.'
    }
  },
  indexes: [
    {
      name: 'organizationId_instanceId_updatedAt',
      keys: ['organizationId', 'instanceId', 'updatedAt']
    }
  ]
};

export let sourceKindPath = (kind: (typeof sourceKinds)[number]) => `lastSeen.${kind}`;
