import type {
  GetApplicatorByType,
  GetHashFunctionByType,
  GetPruneScopeByType,
  Initializer,
  Serializer
} from './types';

export let createApplicator = <Type extends Serializer['type'], InitResult>(
  type: Type,
  init: Initializer<Type, InitResult>,
  d: {
    apply: GetApplicatorByType<Type, InitResult>;
    getHash: GetHashFunctionByType<Type, InitResult>;
    getPruneScope?: GetPruneScopeByType<Type>;
  }
) => ({
  type,
  init,
  apply: d.apply,
  getHash: d.getHash,
  getPruneScope: d.getPruneScope
});
