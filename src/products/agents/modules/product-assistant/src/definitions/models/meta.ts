import { gateway } from 'ai';
import { model, provider } from '../../lib/definitions';

let meta = provider({
  name: 'Meta',
  slug: 'meta'
});

export let metaLlama3170b = model({
  model: gateway('meta/llama-3.1-70b'),
  name: 'Llama 3.1 70B',
  slug: 'llama-3-1-70b',
  provider: meta
});

export let metaLlama318b = model({
  model: gateway('meta/llama-3.1-8b'),
  name: 'Llama 3.1 8B',
  slug: 'llama-3-1-8b',
  provider: meta
});

export let metaLlama3211b = model({
  model: gateway('meta/llama-3.2-11b'),
  name: 'Llama 3.2 11B',
  slug: 'llama-3-2-11b',
  provider: meta
});

export let metaLlama321b = model({
  model: gateway('meta/llama-3.2-1b'),
  name: 'Llama 3.2 1B',
  slug: 'llama-3-2-1b',
  provider: meta
});

export let metaLlama323b = model({
  model: gateway('meta/llama-3.2-3b'),
  name: 'Llama 3.2 3B',
  slug: 'llama-3-2-3b',
  provider: meta
});

export let metaLlama3290b = model({
  model: gateway('meta/llama-3.2-90b'),
  name: 'Llama 3.2 90B',
  slug: 'llama-3-2-90b',
  provider: meta
});

export let metaLlama3370b = model({
  model: gateway('meta/llama-3.3-70b'),
  name: 'Llama 3.3 70B',
  slug: 'llama-3-3-70b',
  provider: meta
});

export let metaLlama4Maverick = model({
  model: gateway('meta/llama-4-maverick'),
  name: 'Llama 4 Maverick',
  slug: 'llama-4-maverick',
  provider: meta
});

export let metaLlama4Scout = model({
  model: gateway('meta/llama-4-scout'),
  name: 'Llama 4 Scout',
  slug: 'llama-4-scout',
  provider: meta
});
