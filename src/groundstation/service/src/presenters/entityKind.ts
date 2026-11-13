import type { KindDefinition } from '../entities/kinds';

export let entityKindPresenter = (kind: KindDefinition) => ({
  object: 'groundstation#entity_kind',

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
