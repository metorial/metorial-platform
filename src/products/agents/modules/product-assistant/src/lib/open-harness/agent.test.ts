import { describe, expect, it } from 'vitest';
import { createE2EModel } from '../definitions/e2eModel';
import { Agent } from './agent';

let reply = async (agent: Agent) => {
  let text = '';

  for await (let event of agent.run([], 'hello')) {
    if (event.type == 'text.delta') text += event.text;
  }

  return text;
};

describe('Agent step model selection', () => {
  it('uses the configured model without a selector', async () => {
    let agent = new Agent({
      name: 'test',
      model: await createE2EModel('primary'),
      instructions: false
    });

    expect(await reply(agent)).toContain('Echo from primary');
  });

  it('runs each step on the selected model', async () => {
    let fallback = await createE2EModel('fallback');
    let seen: (AbortSignal | undefined)[] = [];
    let agent = new Agent({
      name: 'test',
      model: await createE2EModel('primary'),
      selectStepModel: async signal => {
        seen.push(signal);
        return fallback;
      },
      instructions: false
    });

    expect(await reply(agent)).toContain('Echo from fallback');
    expect(seen).toHaveLength(1);
  });
});
