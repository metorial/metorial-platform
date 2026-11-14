import { gateway } from 'ai';
import { model, provider } from '../../lib/definitions';

let xai = provider({
  name: 'xAI',
  slug: 'xai'
});

export let xaiGrok4 = model({
  model: gateway('xai/grok-4'),
  name: 'Grok 4',
  slug: 'grok-4',
  provider: xai
});

export let xaiGrok4FastNonReasoning = model({
  model: gateway('xai/grok-4-fast-non-reasoning'),
  name: 'Grok 4 Fast (non-reasoning)',
  slug: 'grok-4-fast-non-reasoning',
  provider: xai
});

export let xaiGrok4FastReasoning = model({
  model: gateway('xai/grok-4-fast-reasoning'),
  name: 'Grok 4 Fast (reasoning)',
  slug: 'grok-4-fast-reasoning',
  provider: xai
});

export let xaiGrok41FastNonReasoning = model({
  model: gateway('xai/grok-4.1-fast-non-reasoning'),
  name: 'Grok 4.1 Fast (non-reasoning)',
  slug: 'grok-4-1-fast-non-reasoning',
  provider: xai
});

export let xaiGrok41FastReasoning = model({
  model: gateway('xai/grok-4.1-fast-reasoning'),
  name: 'Grok 4.1 Fast (reasoning)',
  slug: 'grok-4-1-fast-reasoning',
  provider: xai
});

export let xaiGrok420MultiAgent = model({
  model: gateway('xai/grok-4.20-multi-agent'),
  name: 'Grok 4.20 Multi-Agent',
  slug: 'grok-4-20-multi-agent',
  provider: xai
});

export let xaiGrok420MultiAgentBeta = model({
  model: gateway('xai/grok-4.20-multi-agent-beta'),
  name: 'Grok 4.20 Multi-Agent Beta',
  slug: 'grok-4-20-multi-agent-beta',
  provider: xai
});

export let xaiGrok420NonReasoning = model({
  model: gateway('xai/grok-4.20-non-reasoning'),
  name: 'Grok 4.20 (non-reasoning)',
  slug: 'grok-4-20-non-reasoning',
  provider: xai
});

export let xaiGrok420NonReasoningBeta = model({
  model: gateway('xai/grok-4.20-non-reasoning-beta'),
  name: 'Grok 4.20 Non-Reasoning Beta',
  slug: 'grok-4-20-non-reasoning-beta',
  provider: xai
});

export let xaiGrok420Reasoning = model({
  model: gateway('xai/grok-4.20-reasoning'),
  name: 'Grok 4.20 (reasoning)',
  slug: 'grok-4-20-reasoning',
  provider: xai
});

export let xaiGrok420ReasoningBeta = model({
  model: gateway('xai/grok-4.20-reasoning-beta'),
  name: 'Grok 4.20 Reasoning Beta',
  slug: 'grok-4-20-reasoning-beta',
  provider: xai
});

export let xaiGrok43 = model({
  model: gateway('xai/grok-4.3'),
  name: 'Grok 4.3',
  slug: 'grok-4-3',
  provider: xai
});
