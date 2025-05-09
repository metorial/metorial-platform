import { MetorialMapper } from '../types';

export let passthroughMapper = (): MetorialMapper<any> => ({
  transformFrom: (input: any) => input,
  transformTo: (input: any) => input
});
