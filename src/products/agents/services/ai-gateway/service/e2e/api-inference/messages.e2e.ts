import { catalogModels } from '@mtsrc/ai-gateway-testing';
import { describe, expect, it } from 'vitest';
import { anthropicClient, anthropicHeaders, inferenceRest } from '../support/client';
import { createToken, drain, useCatalog, useTenant, useUpstream } from '../support/fixtures';

describe('ai-gateway /v1/messages', () => {
  useCatalog();
  let upstream = useUpstream();
  let tenant = useTenant();

  let client = async () => anthropicClient((await createToken(tenant)).secret);

  it('returns a message with usage', async () => {
    upstream.respond({
      steps: [{ type: 'text', text: 'Hi from Claude' }],
      usage: { input: 14, output: 6 }
    });

    let message = await (
      await client()
    ).messages.create({
      model: catalogModels.haiku,
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Hello' }]
    });

    expect(message).toMatchObject({
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hi from Claude' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 14, output_tokens: 6 }
    });
  });

  it('streams message events', async () => {
    upstream.respond({ steps: [{ type: 'text', text: 'Streaming message' }] });

    let stream = await (
      await client()
    ).messages.create({
      model: catalogModels.haiku,
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Hello' }],
      stream: true
    });
    let events = (await drain(stream)) as any[];

    let types = events.map(event => event.type);
    expect(types[0]).toBe('message_start');
    expect(types.at(-1)).toBe('message_stop');
    expect(
      events
        .filter(event => event.type == 'content_block_delta')
        .map(event => event.delta.text)
        .join('')
    ).toBe('Streaming message');
  });

  it('returns tool use blocks', async () => {
    upstream.respond({
      steps: [{ type: 'tool-call', id: 'toolu_1', name: 'lookup', input: { id: 4 } }]
    });

    let message = await (
      await client()
    ).messages.create({
      model: catalogModels.haiku,
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Look up 4' }],
      tools: [
        {
          name: 'lookup',
          description: 'Looks something up',
          input_schema: { type: 'object', properties: { id: { type: 'number' } } }
        }
      ]
    });

    expect(message.stop_reason).toBe('tool_use');
    expect(message.content).toMatchObject([
      { type: 'tool_use', id: 'toolu_1', name: 'lookup', input: { id: 4 } }
    ]);
  });

  it('serves non-Anthropic models through the Anthropic API', async () => {
    let message = await (
      await client()
    ).messages.create({
      model: catalogModels.gpt,
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Hello' }]
    });

    expect(message.content[0]).toMatchObject({ type: 'text' });
    expect(new URL(upstream.requests[0]!.url).hostname).toBe('api.openai.com');
  });

  it('counts tokens', async () => {
    upstream.respond({ steps: [], usage: { input: 42, output: 0 } });

    let count = await (
      await client()
    ).messages.countTokens({
      model: catalogModels.haiku,
      messages: [{ role: 'user', content: 'How many tokens is this?' }]
    });

    expect(count.input_tokens).toBe(42);
    expect(upstream.requests[0]!.wire).toBe('anthropic-count-tokens');
  });

  it('shapes errors like the Anthropic API', async () => {
    let token = await createToken(tenant);

    let invalid = await inferenceRest(token.secret).post('/v1/messages', {
      body: { model: catalogModels.haiku },
      headers: anthropicHeaders
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body).toMatchObject({
      type: 'error',
      error: { type: 'invalid_request_error' }
    });

    await expect(
      (await client()).messages.create({
        model: 'nobody/nothing',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }]
      })
    ).rejects.toMatchObject({ status: 404 });
  });

  it('answers rate limit headers in the Anthropic format', async () => {
    let token = await createToken(tenant, {
      limits: [{ metric: 'requests', amount: 50, interval: '1d' }]
    });

    let response = await inferenceRest(token.secret).post('/v1/messages', {
      body: {
        model: catalogModels.haiku,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }]
      },
      headers: anthropicHeaders
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('anthropic-ratelimit-requests-limit')).toBe('50');
    expect(response.headers.get('anthropic-ratelimit-requests-remaining')).toBe('49');
  });
});
