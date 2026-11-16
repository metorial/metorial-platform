import { gateway } from 'ai';
import { model, provider } from '../../lib/definitions';

let anthropic = provider({
  name: 'Anthropic',
  slug: 'anthropic'
});

export let claudeSonnet45 = model({
  model: gateway('anthropic/claude-sonnet-4.5'),
  name: 'Claude Sonnet 4.5',
  slug: 'claude-sonnet-4-5',
  provider: anthropic
});

export let claudeSonnet46 = model({
  model: gateway('anthropic/claude-sonnet-4.6'),
  name: 'Claude Sonnet 4.6',
  slug: 'claude-sonnet-4-6',
  provider: anthropic
});

export let claudeHaiku45 = model({
  model: gateway('anthropic/claude-haiku-4.5'),
  name: 'Claude Haiku 4.5',
  slug: 'claude-haiku-4-5',
  provider: anthropic
});

export let claudeOpus45 = model({
  model: gateway('anthropic/claude-opus-4.5'),
  name: 'Claude Opus 4.5',
  slug: 'claude-opus-4-5',
  provider: anthropic
});

export let claudeOpus46 = model({
  model: gateway('anthropic/claude-opus-4.6'),
  name: 'Claude Opus 4.6',
  slug: 'claude-opus-4-6',
  provider: anthropic
});

export let claudeOpus47 = model({
  model: gateway('anthropic/claude-opus-4.7'),
  name: 'Claude Opus 4.7',
  slug: 'claude-opus-4-7',
  provider: anthropic
});
