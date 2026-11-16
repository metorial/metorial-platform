import { gateway } from 'ai';
import { model, provider } from '../../lib/definitions';

let cohere = provider({
  name: 'Cohere',
  slug: 'cohere'
});

export let cohereCommandA = model({
  model: gateway('cohere/command-a'),
  name: 'Command A',
  slug: 'command-a',
  provider: cohere
});
