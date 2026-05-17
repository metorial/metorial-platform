import type { Serializer } from './types';

export let createApplicator = <Type extends Serializer['type'], InitResult>(
  type: Type,
  init: (
    ...d: Parameters<Extract<Serializer, { type: Type }>['getHash']>
  ) => Promise<InitResult>,
  d: {
    apply: Extract<Serializer, { type: Type }>['apply'];
    getHash: Extract<Serializer, { type: Type }>['getHash'];
  }
): Extract<Serializer, { type: Type }> =>
  ({
    type,
    apply: d.apply,
    getHash: d.getHash
  }) as any;
