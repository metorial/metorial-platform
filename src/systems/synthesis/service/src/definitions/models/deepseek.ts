import { gateway } from 'ai';
import { model, provider } from '../../lib/definitions';

let deepseek = provider({
  name: 'DeepSeek',
  slug: 'deepseek'
});

export let deepseekR1 = model({
  model: gateway('deepseek/deepseek-r1'),
  name: 'DeepSeek R1',
  slug: 'deepseek-r1',
  provider: deepseek
});

export let deepseekV3 = model({
  model: gateway('deepseek/deepseek-v3'),
  name: 'DeepSeek V3',
  slug: 'deepseek-v3',
  provider: deepseek
});

export let deepseekV31 = model({
  model: gateway('deepseek/deepseek-v3.1'),
  name: 'DeepSeek V3.1',
  slug: 'deepseek-v3-1',
  provider: deepseek
});

export let deepseekV31Terminus = model({
  model: gateway('deepseek/deepseek-v3.1-terminus'),
  name: 'DeepSeek V3.1 Terminus',
  slug: 'deepseek-v3-1-terminus',
  provider: deepseek
});

export let deepseekV32 = model({
  model: gateway('deepseek/deepseek-v3.2'),
  name: 'DeepSeek V3.2',
  slug: 'deepseek-v3-2',
  provider: deepseek
});

export let deepseekV32Thinking = model({
  model: gateway('deepseek/deepseek-v3.2-thinking'),
  name: 'DeepSeek V3.2 Thinking',
  slug: 'deepseek-v3-2-thinking',
  provider: deepseek
});

export let deepseekV4Flash = model({
  model: gateway('deepseek/deepseek-v4-flash'),
  name: 'DeepSeek V4 Flash',
  slug: 'deepseek-v4-flash',
  provider: deepseek
});

export let deepseekV4Pro = model({
  model: gateway('deepseek/deepseek-v4-pro'),
  name: 'DeepSeek V4 Pro',
  slug: 'deepseek-v4-pro',
  provider: deepseek
});
