import type { RawBuild } from './types';

export let bunService = (spec: Omit<RawBuild, 'kind'> = {}): RawBuild => ({
  kind: 'bun-service',
  ...spec
});
