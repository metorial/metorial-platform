import { catalogModels } from '@mtsrc/ai-gateway-testing';
import { describe, expect, it } from 'vitest';
import { inferenceRest, openaiClient } from '../support/client';
import { createToken, drain, useCatalog, useTenant, useUpstream } from '../support/fixtures';

describe('ai-gateway /v1/responses', () => {
  useCatalog();
  let upstream = useUpstream();
  let tenant = useTenant();

  let client = async () => openaiClient((await createToken(tenant)).secret);

  it('returns a response with usage', async () => {
    upstream.respond({
      steps: [{ type: 'text', text: 'Hello from responses' }],
      usage: { input: 11, output: 6 }
    });

    let response = await (
      await client()
    ).responses.create({
      model: catalogModels.haiku,
      input: 'Hello'
    });

    expect(response).toMatchObject({
      object: 'response',
      status: 'completed',
      output_text: 'Hello from responses',
      usage: { input_tokens: 11, output_tokens: 6, total_tokens: 17 }
    });
  });

  it('streams response events', async () => {
    upstream.respond({ steps: [{ type: 'text', text: 'Streamed response' }] });

    let stream = await (
      await client()
    ).responses.create({
      model: catalogModels.gpt,
      input: 'Hello',
      stream: true
    });
    let events = (await drain(stream)) as any[];

    let types = events.map(event => event.type);
    expect(types[0]).toBe('response.created');
    expect(types.at(-1)).toBe('response.completed');
    expect(
      events
        .filter(event => event.type == 'response.output_text.delta')
        .map(event => event.delta)
        .join('')
    ).toBe('Streamed response');
  });

  it('returns function calls', async () => {
    upstream.respond({
      steps: [{ type: 'tool-call', id: 'call_9', name: 'lookup', input: { id: 4 } }]
    });

    let response = await (
      await client()
    ).responses.create({
      model: catalogModels.haiku,
      input: 'Look up 4',
      tools: [
        {
          type: 'function',
          name: 'lookup',
          strict: false,
          description: 'Looks something up',
          parameters: { type: 'object', properties: { id: { type: 'number' } } }
        }
      ]
    });

    expect(response.output).toMatchObject([
      { type: 'function_call', name: 'lookup', arguments: '{"id":4}' }
    ]);
  });

  it('rejects an invalid request', async () => {
    let token = await createToken(tenant);

    let response = await inferenceRest(token.secret).post('/v1/responses', { body: {} });

    expect(response.status).toBe(400);
    expect(response.body.error.type).toBe('invalid_request_error');
  });
});
