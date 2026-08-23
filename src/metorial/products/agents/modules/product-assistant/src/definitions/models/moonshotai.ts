import { gateway } from 'ai';
import { model, provider } from '../../lib/definitions';

let moonshotai = provider({
  name: 'Moonshot AI',
  slug: 'moonshotai'
});

export let moonshotaiKimiK2 = model({
  model: gateway('moonshotai/kimi-k2'),
  name: 'Kimi K2',
  slug: 'kimi-k2',
  provider: moonshotai
});

export let moonshotaiKimiK2Thinking = model({
  model: gateway('moonshotai/kimi-k2-thinking'),
  name: 'Kimi K2 Thinking',
  slug: 'kimi-k2-thinking',
  provider: moonshotai
});

export let moonshotaiKimiK2ThinkingTurbo = model({
  model: gateway('moonshotai/kimi-k2-thinking-turbo'),
  name: 'Kimi K2 Thinking Turbo',
  slug: 'kimi-k2-thinking-turbo',
  provider: moonshotai
});

export let moonshotaiKimiK2Turbo = model({
  model: gateway('moonshotai/kimi-k2-turbo'),
  name: 'Kimi K2 Turbo',
  slug: 'kimi-k2-turbo',
  provider: moonshotai
});

export let moonshotaiKimiK25 = model({
  model: gateway('moonshotai/kimi-k2.5'),
  name: 'Kimi K2.5',
  slug: 'kimi-k2-5',
  provider: moonshotai
});

export let moonshotaiKimiK26 = model({
  model: gateway('moonshotai/kimi-k2.6'),
  name: 'Kimi K2.6',
  slug: 'kimi-k2-6',
  provider: moonshotai
});
