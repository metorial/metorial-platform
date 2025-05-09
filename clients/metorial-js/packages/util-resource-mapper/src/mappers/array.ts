import { MetorialMapper } from '../types';

export let arrayMapper = <T = any>(mapper: MetorialMapper<T>): MetorialMapper<T> => ({
  transformFrom: (input: any): T => {
    if (!Array.isArray(input)) return input;
    if (input.length == 0) return input as T;

    return input.map((item: any) => mapper.transformFrom(item)) as T;
  },

  transformTo: (input: any) => {
    if (!Array.isArray(input)) return input;
    if (input.length == 0) return input;

    return input.map((item: any) => mapper.transformTo(item));
  }
});
