import { gateway } from 'ai';
import { model, provider } from '../../lib/definitions';

let mistral = provider({
  name: 'Mistral',
  slug: 'mistral'
});

export let mistralCodestral = model({
  model: gateway('mistral/codestral'),
  name: 'Codestral',
  slug: 'codestral',
  provider: mistral
});

export let mistralMinistral14b = model({
  model: gateway('mistral/ministral-14b'),
  name: 'Ministral 14B',
  slug: 'ministral-14b',
  provider: mistral
});

export let mistralLarge3 = model({
  model: gateway('mistral/mistral-large-3'),
  name: 'Mistral Large 3',
  slug: 'mistral-large-3',
  provider: mistral
});

export let mistralMedium = model({
  model: gateway('mistral/mistral-medium'),
  name: 'Mistral Medium',
  slug: 'mistral-medium',
  provider: mistral
});
