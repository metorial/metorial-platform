import type { EntityKind } from '../../prisma/generated/client';
import type { TagOrigin } from '../types';

export type EntityCardinality = 'single' | 'multi';

export type KindDefinition = {
  key: string;
  name: string;
  cardinality: EntityCardinality;
  builtIn: boolean;
  taggable: boolean;
  cardinalityConfigurable: boolean;
  description: string | null;
  tagOrigins: TagOrigin[];
  record: EntityKind | null;
};

type BuiltInKind = Omit<KindDefinition, 'builtIn' | 'record' | 'description'>;

export let customKindPrefix = 'custom:';

export let customKindTagOrigins: TagOrigin[] = ['source', 'repo'];

export let builtInKinds: BuiltInKind[] = [
  {
    key: 'user',
    name: 'User',
    cardinality: 'single',
    taggable: false,
    cardinalityConfigurable: false,
    tagOrigins: []
  },
  {
    key: 'device',
    name: 'Device',
    cardinality: 'single',
    taggable: false,
    cardinalityConfigurable: false,
    tagOrigins: []
  },
  {
    key: 'client_user',
    name: 'Client user',
    cardinality: 'single',
    taggable: false,
    cardinalityConfigurable: false,
    tagOrigins: []
  },
  {
    key: 'client_installation',
    name: 'Client installation',
    cardinality: 'single',
    taggable: false,
    cardinalityConfigurable: false,
    tagOrigins: []
  },
  {
    key: 'agent',
    name: 'Agent',
    cardinality: 'multi',
    taggable: true,
    cardinalityConfigurable: false,
    tagOrigins: ['source']
  },
  {
    key: 'repo',
    name: 'Repository',
    cardinality: 'multi',
    taggable: true,
    cardinalityConfigurable: false,
    tagOrigins: ['source']
  },
  {
    key: 'workspace',
    name: 'Workspace',
    cardinality: 'single',
    taggable: true,
    cardinalityConfigurable: false,
    tagOrigins: ['source', 'repo']
  },
  {
    key: 'team',
    name: 'Team',
    cardinality: 'multi',
    taggable: true,
    cardinalityConfigurable: true,
    tagOrigins: ['source']
  },
  {
    key: 'project',
    name: 'Project',
    cardinality: 'single',
    taggable: true,
    cardinalityConfigurable: true,
    tagOrigins: ['source', 'repo']
  },
  {
    key: 'cost_center',
    name: 'Cost center',
    cardinality: 'single',
    taggable: true,
    cardinalityConfigurable: true,
    tagOrigins: ['source']
  }
];

let builtInKindsByKey = new Map(builtInKinds.map(kind => [kind.key, kind]));

let customSlugPattern = /^[a-z0-9][a-z0-9_-]*$/;

export let isBuiltInKind = (key: string) => builtInKindsByKey.has(key);

export let isCustomKindKey = (key: string) =>
  key.startsWith(customKindPrefix) &&
  key.length <= 64 &&
  customSlugPattern.test(key.slice(customKindPrefix.length));

export let isValidKindKey = (key: string) => isBuiltInKind(key) || isCustomKindKey(key);

export let isCustomerManagedKind = (key: string) =>
  key == 'team' || key == 'project' || key == 'cost_center' || isCustomKindKey(key);

let fromRecord = (record: EntityKind): KindDefinition => ({
  key: record.key,
  name: record.name,
  cardinality: record.cardinality,
  builtIn: false,
  taggable: true,
  cardinalityConfigurable: true,
  description: record.attributes.description ?? null,
  tagOrigins: record.attributes.tagOrigins ?? customKindTagOrigins,
  record
});

export let resolveKindDefinition = (
  key: string,
  record: EntityKind | null | undefined
): KindDefinition | null => {
  let builtIn = builtInKindsByKey.get(key);

  if (!builtIn) {
    if (!record || record.archivedAt) return null;
    return fromRecord(record);
  }

  return {
    ...builtIn,
    builtIn: true,
    name: record?.name ?? builtIn.name,
    cardinality: builtIn.cardinalityConfigurable
      ? (record?.cardinality ?? builtIn.cardinality)
      : builtIn.cardinality,
    description: record?.attributes.description ?? null,
    tagOrigins: builtIn.taggable
      ? (record?.attributes.tagOrigins ?? builtIn.tagOrigins)
      : builtIn.tagOrigins,
    record: record ?? null
  };
};

export let mergeKindDefinitions = (records: EntityKind[]): KindDefinition[] => {
  let recordsByKey = new Map(records.map(record => [record.key, record]));

  let builtIns = builtInKinds.map(kind =>
    resolveKindDefinition(kind.key, recordsByKey.get(kind.key))!
  );

  let custom = records
    .filter(record => !isBuiltInKind(record.key) && !record.archivedAt)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(fromRecord);

  return [...builtIns, ...custom];
};
