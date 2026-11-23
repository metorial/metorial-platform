import { catalogModels } from '@mtsrc/ai-gateway-testing';
import { describe, expect, it } from 'vitest';
import { inferenceRest, inferenceUrl, openaiClient } from '../support/client';
import {
  apiKeys,
  createToken,
  drain,
  useCatalog,
  useTenant,
  useUpstream
} from '../support/fixtures';

describe('ai-gateway /v1/chat/completions', () => {
  useCatalog();
  let upstream = useUpstream();
  let tenant = useTenant();

  let client = async () => openaiClient((await createToken(tenant)).secret);

  it('returns a completion with usage', async () => {
    upstream.respond({
      steps: [{ type: 'text', text: 'Hi there' }],
      usage: { input: 20, output: 5 }
    });

    let completion = await (
      await client()
    ).chat.completions.create({
      model: catalogModels.haiku,
      messages: [{ role: 'user', content: 'Hello' }]
    });

    expect(completion).toMatchObject({
      object: 'chat.completion',
      choices: [
        {
          index: 0,
          finish_reason: 'stop',
          message: { role: 'assistant', content: 'Hi there' }
        }
      ],
      usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 }
    });
  });

  it('translates the request for the upstream provider', async () => {
    let completion = await (
      await client()
    ).chat.completions.create({
      model: catalogModels.sonnet,
      messages: [
        { role: 'system', content: 'Be brief.' },
        { role: 'user', content: 'Hello' }
      ],
      max_tokens: 100
    });
    expect(completion.model).toBeTruthy();

    expect(upstream.requests).toHaveLength(1);
    let [request] = upstream.requests;
    expect(request!.wire).toBe('anthropic-messages');
    expect(request!.body).toMatchObject({
      model: 'claude-sonnet-5',
      max_tokens: 100,
      stream: true
    });
    expect(JSON.stringify(request!.body)).toContain('Be brief.');
    expect(request!.headers['x-api-key']).toBe(apiKeys.platformAnthropic);
  });

  it('serves OpenAI models over the OpenAI upstream', async () => {
    await (
      await client()
    ).chat.completions.create({
      model: catalogModels.gpt,
      messages: [{ role: 'user', content: 'Hello' }]
    });

    expect(new URL(upstream.requests[0]!.url).hostname).toBe('api.openai.com');
    expect(upstream.requests[0]!.body.model).toBe('gpt-6');
  });

  it('streams a completion', async () => {
    upstream.respond({
      steps: [{ type: 'text', text: 'Streaming works fine' }],
      usage: { input: 8, output: 4 }
    });

    let stream = await (
      await client()
    ).chat.completions.create({
      model: catalogModels.haiku,
      messages: [{ role: 'user', content: 'Hello' }],
      stream: true,
      stream_options: { include_usage: true }
    });
    let chunks = (await drain(stream)) as any[];

    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.map(chunk => chunk.choices[0]?.delta?.content ?? '').join('')).toBe(
      'Streaming works fine'
    );
    expect(chunks.some(chunk => chunk.choices[0]?.finish_reason == 'stop')).toBe(true);
    expect(chunks.at(-1).usage).toMatchObject({ prompt_tokens: 8, completion_tokens: 4 });
  });

  it('returns tool calls', async () => {
    upstream.respond({
      steps: [
        { type: 'tool-call', id: 'call_1', name: 'get_weather', input: { city: 'Berlin' } }
      ]
    });

    let completion = await (
      await client()
    ).chat.completions.create({
      model: catalogModels.haiku,
      messages: [{ role: 'user', content: 'Weather in Berlin?' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            parameters: { type: 'object', properties: { city: { type: 'string' } } }
          }
        }
      ]
    });

    let choice = completion.choices[0]!;
    expect(choice.finish_reason).toBe('tool_calls');
    expect(choice.message.tool_calls).toMatchObject([
      { id: 'call_1', function: { name: 'get_weather', arguments: '{"city":"Berlin"}' } }
    ]);
    expect(upstream.requests[0]!.body.tools).toMatchObject([{ name: 'get_weather' }]);
  });

  it('maps length finishes', async () => {
    upstream.respond({ steps: [{ type: 'text', text: 'Cut o' }], finish: 'length' });

    let completion = await (
      await client()
    ).chat.completions.create({
      model: catalogModels.haiku,
      messages: [{ role: 'user', content: 'Write a lot' }]
    });

    expect(completion.choices[0]!.finish_reason).toBe('length');
  });

  it('rejects an invalid request without calling the upstream', async () => {
    let token = await createToken(tenant);

    for (let body of [{}, { model: catalogModels.haiku }, { messages: [] }]) {
      let response = await inferenceRest(token.secret).post('/v1/chat/completions', { body });
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(response.body.error.type).toBe('invalid_request_error');
    }
    expect(upstream.requests).toEqual([]);
  });

  it('rejects bodies that are not JSON', async () => {
    let token = await createToken(tenant);

    let response = await fetch(`${inferenceUrl()}/v1/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token.secret}`, 'content-type': 'application/json' },
      body: '{not json'
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('invalid_json');
  });

  it('rejects an unknown model', async () => {
    let token = await createToken(tenant);

    let response = await inferenceRest(token.secret).post('/v1/chat/completions', {
      body: { model: 'nobody/nothing', messages: [{ role: 'user', content: 'Hi' }] }
    });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('model_not_found');
  });

  it('maps upstream failures to gateway errors', async () => {
    let token = await createToken(tenant);
    let call = () =>
      inferenceRest(token.secret).post('/v1/chat/completions', {
        body: { model: catalogModels.haiku, messages: [{ role: 'user', content: 'Hi' }] }
      });

    upstream.respond({
      steps: [],
      httpError: { status: 400, body: { error: { message: 'max_tokens is too large' } } }
    });
    let invalid = await call();
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('upstream_invalid_request');
    expect(invalid.body.error.message).toContain('max_tokens is too large');

    upstream.respond({
      steps: [],
      httpError: {
        status: 429,
        body: { error: { message: 'slow down' } },
        headers: { 'retry-after': '7' }
      }
    });
    let limited = await call();
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('upstream_rate_limited');

    upstream.respond({
      steps: [],
      httpError: { status: 529, body: { error: { message: 'busy' } } }
    });
    let overloaded = await call();
    expect(overloaded.status).toBe(503);
    expect(overloaded.body.error.code).toBe('upstream_overloaded');
  });

  it('does not leak that Metorial keys were rejected', async () => {
    let token = await createToken(tenant);
    upstream.respond({
      steps: [],
      httpError: {
        status: 401,
        body: { error: { message: 'bad key e2e-platform-anthropic-key' } }
      }
    });

    let response = await inferenceRest(token.secret).post('/v1/chat/completions', {
      body: { model: catalogModels.haiku, messages: [{ role: 'user', content: 'Hi' }] }
    });

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe('upstream_authentication_failed');
    expect(response.text).not.toContain('e2e-platform-anthropic-key');
    expect(response.body.error.message).toBe('The model provider is temporarily unavailable.');
  });

  it('reports a stream that dies half way', async () => {
    upstream.respond({
      steps: [{ type: 'text', text: 'Partial answer that never finishes' }],
      failMidStream: { message: 'connection reset' }
    });

    let stream = await (
      await client()
    ).chat.completions.create({
      model: catalogModels.haiku,
      messages: [{ role: 'user', content: 'Hello' }],
      stream: true
    });

    await expect(drain(stream)).rejects.toThrow();
  });

  it('rate limit headers appear when limits apply', async () => {
    let token = await createToken(tenant, {
      limits: [{ metric: 'requests', amount: 50, interval: '1d' }]
    });

    let response = await inferenceRest(token.secret).post('/v1/chat/completions', {
      body: { model: catalogModels.haiku, messages: [{ role: 'user', content: 'Hi' }] }
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('x-ratelimit-limit-requests')).toBe('50');
    expect(response.headers.get('x-ratelimit-remaining-requests')).toBe('49');
  });
});
