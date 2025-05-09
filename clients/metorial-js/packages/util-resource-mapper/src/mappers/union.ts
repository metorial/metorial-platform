import { MetorialMapper } from '../types';

let getType = (input: any): string => {
  if (Array.isArray(input)) return 'array';
  if (input instanceof Date) return 'date';
  if (typeof input == 'object' && input != null) return 'object';
  return typeof input;
};

export let unionMapper = (options: MetorialUnionMapperOption[]): MetorialMapper<any> => {
  let mappersByType = new Map(options.map(o => [o.type, o.mapper]));

  return {
    transformFrom: (input: any) => {
      let mapper = mappersByType.get(getType(input));
      if (!mapper) return input;

      return mapper.transformFrom(input);
    },

    transformTo: (input: any) => {
      let mapper = mappersByType.get(getType(input));
      if (!mapper) return input;

      return mapper.transformTo(input);
    }
  };
};

export let unionOption = (
  type: string,
  mapper: MetorialMapper<any>
): MetorialUnionMapperOption => ({
  type,
  mapper
});

export interface MetorialUnionMapperOption {
  type: string;
  mapper: MetorialMapper<any>;
}
