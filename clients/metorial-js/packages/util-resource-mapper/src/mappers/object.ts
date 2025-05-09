import { MetorialMapper } from '../types';

export let objectMapper = <T = any>(
  properties: Record<string, MetorialObjectMapperField>
): MetorialMapper<T> => {
  let fromTransformers = new Map(
    Object.entries(properties).map(([toKey, value]) => [
      value.fromKey,
      { toKey, mapper: value.mapper }
    ])
  );

  let toTransformers = new Map(
    Object.entries(properties).map(([toKey, value]) => [
      toKey,
      { fromKey: value.fromKey, mapper: value.mapper }
    ])
  );

  return {
    transformFrom: (input: any): T => {
      if (typeof input != 'object' || input == null) return input;

      let output: any = {};
      let keys = new Set(Object.keys(input));

      for (let [fromKey, { toKey, mapper }] of fromTransformers) {
        if (!keys.has(fromKey)) continue;

        output[toKey] = mapper.transformFrom(input[fromKey]);
        keys.delete(fromKey);
      }

      for (let key of keys) {
        output[key] = input[key];
      }

      return output;
    },

    transformTo: (input: any) => {
      if (typeof input != 'object' || input == null) return input;

      let output: any = {};
      let keys = new Set(Object.keys(input));

      for (let [toKey, { fromKey, mapper }] of toTransformers) {
        if (!keys.has(toKey)) continue;

        output[fromKey] = mapper.transformTo(input[toKey]);
        keys.delete(toKey);
      }

      for (let key of keys) {
        output[key] = input[key];
      }

      return output;
    }
  };
};

export let objectField = (
  fromKey: string,
  mapper: MetorialMapper<any>
): MetorialObjectMapperField => ({
  fromKey,
  mapper
});

export interface MetorialObjectMapperField {
  fromKey: string;
  mapper: MetorialMapper<any>;
}
