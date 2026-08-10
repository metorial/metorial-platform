import { gateway } from 'ai';
import { model, provider } from '../../lib/definitions';

let openai = provider({
  name: 'OpenAI',
  slug: 'openai'
});

export let openaiGpt52 = model({
  model: gateway('openai/gpt-5.2'),
  name: 'GPT-5.2',
  slug: 'gpt-5-2',
  provider: openai
});

export let openaiGpt52Chat = model({
  model: gateway('openai/gpt-5.2-chat'),
  name: 'GPT-5.2 Chat',
  slug: 'gpt-5-2-chat',
  provider: openai
});

export let openaiGpt52Codex = model({
  model: gateway('openai/gpt-5.2-codex'),
  name: 'GPT-5.2 Codex',
  slug: 'gpt-5-2-codex',
  provider: openai
});

export let openaiGpt52Pro = model({
  model: gateway('openai/gpt-5.2-pro'),
  name: 'GPT-5.2 Pro',
  slug: 'gpt-5-2-pro',
  provider: openai
});

export let openaiGpt53Chat = model({
  model: gateway('openai/gpt-5.3-chat'),
  name: 'GPT-5.3 Chat',
  slug: 'gpt-5-3-chat',
  provider: openai
});

export let openaiGpt53Codex = model({
  model: gateway('openai/gpt-5.3-codex'),
  name: 'GPT-5.3 Codex',
  slug: 'gpt-5-3-codex',
  provider: openai
});

export let openaiGpt54 = model({
  model: gateway('openai/gpt-5.4'),
  name: 'GPT-5.4',
  slug: 'gpt-5-4',
  provider: openai
});

export let openaiGpt54Mini = model({
  model: gateway('openai/gpt-5.4-mini'),
  name: 'GPT-5.4 Mini',
  slug: 'gpt-5-4-mini',
  provider: openai
});

export let openaiGpt54Nano = model({
  model: gateway('openai/gpt-5.4-nano'),
  name: 'GPT-5.4 Nano',
  slug: 'gpt-5-4-nano',
  provider: openai
});

export let openaiGpt54Pro = model({
  model: gateway('openai/gpt-5.4-pro'),
  name: 'GPT-5.4 Pro',
  slug: 'gpt-5-4-pro',
  provider: openai
});

export let openaiGpt55 = model({
  model: gateway('openai/gpt-5.5'),
  name: 'GPT-5.5',
  slug: 'gpt-5-5',
  provider: openai
});

export let openaiGpt55Pro = model({
  model: gateway('openai/gpt-5.5-pro'),
  name: 'GPT-5.5 Pro',
  slug: 'gpt-5-5-pro',
  provider: openai
});

export let openaiGptOss120b = model({
  model: gateway('openai/gpt-oss-120b'),
  name: 'GPT-OSS 120B',
  slug: 'gpt-oss-120b',
  provider: openai
});

export let openaiGptOss20b = model({
  model: gateway('openai/gpt-oss-20b'),
  name: 'GPT-OSS 20B',
  slug: 'gpt-oss-20b',
  provider: openai
});
