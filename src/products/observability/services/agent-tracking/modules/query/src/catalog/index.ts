import type { DatasetName } from '@mtsrc/agent-tracking-query-spec';
import { requestsDataset, toolCallsDataset } from './records';
import { sessionsDataset } from './sessions';
import { sourcesDataset } from './sources';
import type { DatasetDef, FieldDef, ResolvedField } from './types';
import { usageDataset } from './usage';

export * from './types';
export { dayNames } from './fields';
export { sourceKindPath, sourceKinds } from './sources';

let maxTagKeyLength = 64;

let personalKinds = new Set(['user', 'device', 'client_user', 'client_installation']);

let hiddenAttributes = new Set(['email']);

export let datasets: Record<DatasetName, DatasetDef> = {
  usage: usageDataset,
  sessions: sessionsDataset,
  requests: requestsDataset,
  tool_calls: toolCallsDataset,
  sources: sourcesDataset
};

export type KindInfo = {
  key: string;
  name: string;
  multi: boolean;
  attributes: string[];
};

export type CatalogContext = { kinds: Map<string, KindInfo> };

let own = <T>(record: Record<string, T>, key: string) =>
  Object.hasOwn(record, key) ? record[key] : undefined;

let kindField = (dataset: DatasetDef, kind: KindInfo): FieldDef => ({
  type: 'id',
  source: { kind: 'kind', key: kind.key },
  dimension: dataset.kinds?.kind == 'embedded',
  measure: false,
  filter: true,
  select: false,
  multi: kind.multi,
  sensitivity: personalKinds.has(kind.key) ? 'personal' : 'normal',
  cardinality: 'medium',
  label: 'entity',
  entityKind: kind.key,
  distinct: dataset.kinds?.kind == 'embedded',
  description: `Attributed ${kind.name} entities.`
});

let attributeField = (
  dataset: DatasetDef,
  kind: KindInfo,
  attribute: string
): FieldDef | undefined => {
  let stored = Object.values(dataset.fields).find(
    def =>
      def.entityKind == kind.key && (def.source.kind == 'stored' || def.source.kind == 'array')
  );
  let storedName = stored
    ? Object.keys(dataset.fields).find(name => dataset.fields[name] == stored)
    : undefined;

  if (!storedName && !dataset.kinds) return undefined;

  let via = storedName
    ? { kind: 'field' as const, field: storedName }
    : { kind: 'kind' as const };
  let groupable = via.kind == 'field' || dataset.kinds?.kind == 'embedded';

  return {
    type: 'string',
    source: { kind: 'entityAttribute', key: kind.key, attribute, via },
    dimension: groupable,
    measure: false,
    filter: true,
    select: false,
    sensitivity: 'normal',
    cardinality: 'medium',
    searchable: true,
    description: `The ${attribute} attribute of the ${kind.name} entity.`
  };
};

export let resolveField = (
  dataset: DatasetDef,
  name: string,
  context: CatalogContext
): ResolvedField | undefined => {
  let def = own(dataset.fields, name);
  if (def) return { ...def, name };

  if (name.startsWith('tag.') && dataset.tagsPath) {
    let key = name.slice(4);
    if (!key || key.length > maxTagKeyLength) return undefined;

    return {
      name,
      type: 'string',
      source: { kind: 'tag', key },
      dimension: true,
      measure: false,
      filter: true,
      select: true,
      searchable: true,
      sensitivity: 'normal',
      cardinality: 'medium',
      description: `The value of session tag "${key}".`
    };
  }

  let kind = context.kinds.get(name);
  if (kind && dataset.kinds) return { ...kindField(dataset, kind), name };

  let dot = name.lastIndexOf('.');
  if (dot > 0) {
    let owner = context.kinds.get(name.slice(0, dot));
    let attribute = name.slice(dot + 1);

    if (owner && owner.attributes.includes(attribute) && !hiddenAttributes.has(attribute)) {
      let field = attributeField(dataset, owner, attribute);
      if (field) return { ...field, name };
    }
  }

  return undefined;
};

export let fieldNames = (dataset: DatasetDef, context: CatalogContext) => {
  let names = Object.keys(dataset.fields);
  if (dataset.kinds)
    names.push(...[...context.kinds.keys()].filter(key => !own(dataset.fields, key)));

  for (let kind of context.kinds.values()) {
    for (let attribute of kind.attributes) {
      if (resolveField(dataset, `${kind.key}.${attribute}`, context)) {
        names.push(`${kind.key}.${attribute}`);
      }
    }
  }

  return names;
};

export let datasetOf = (name: DatasetName) => datasets[name];
