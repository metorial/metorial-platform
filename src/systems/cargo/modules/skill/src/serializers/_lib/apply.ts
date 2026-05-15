import type { Serializer } from './types';

export let createApplicator = <Type extends Serializer['type']>(
  type: Type,
  apply: Extract<Serializer, { type: Type }>['apply']
): Extract<Serializer, { type: Type }> =>
  ({
    type,
    apply
  }) as any;
