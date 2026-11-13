import type { KindDefinition } from '@mtsrc/agent-tracking-module-entities';

export let entityKindPresenter = (kind: KindDefinition) => ({
  object: 'agent_tracking#entity_kind',

  key: kind.key,
  name: kind.name,
  cardinality: kind.cardinality,

  builtIn: kind.builtIn,
  taggable: kind.taggable,
  cardinalityConfigurable: kind.cardinalityConfigurable,

  attributes: {
    description: kind.description,
    tagOrigins: kind.tagOrigins
  },

  createdAt: kind.record?.createdAt ?? null,
  updatedAt: kind.record?.updatedAt ?? null
});
