import { describe, expect, it, vi } from 'vitest';
import { checkProviderConnection, parseProviderInput, supportedProviderSlugs } from '../src';

let asFetch = (fn: (...args: any[]) => Promise<Response>) =>
  vi.fn(fn) as unknown as typeof fetch & ReturnType<typeof vi.fn>;

let respond = (status: number, body: unknown) =>
  asFetch(async () => new Response(JSON.stringify(body), { status }));

describe('checkProviderConnection', () => {
  it('is valid when the model list loads, and counts the models', async () => {
    let fetch = respond(200, { data: [{ id: 'gpt-5' }, { id: 'gpt-5-mini' }] });

    let result = await checkProviderConnection({
      providerSlug: 'openai',
      credentials: { apiKey: 'sk-test-1234567890' },
      config: {},
      fetch
    });

    expect(result).toEqual({ outcome: 'valid', httpStatus: 200, modelCount: 2 });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer sk-test-1234567890' })
      })
    );
  });

  it('sends the Anthropic key and version headers', async () => {
    let fetch = respond(200, { data: [] });

    await checkProviderConnection({
      providerSlug: 'anthropic',
      credentials: { apiKey: 'sk-ant-test' },
      config: {},
      fetch
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/models',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'sk-ant-test',
          'anthropic-version': '2023-06-01'
        })
      })
    );
  });

  it('builds the Azure URL from the resource name', async () => {
    let fetch = respond(200, { data: [] });

    await checkProviderConnection({
      providerSlug: 'azure',
      credentials: { apiKey: 'azure-key' },
      config: { resourceName: 'my-resource' },
      fetch
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://my-resource.openai.azure.com/openai/v1/models',
      expect.anything()
    );
  });

  it('counts Google models from the models array', async () => {
    let result = await checkProviderConnection({
      providerSlug: 'google-ai-studio',
      credentials: { apiKey: 'AIza-test' },
      config: {},
      fetch: respond(200, { models: [{}, {}, {}] })
    });

    expect(result.modelCount).toBe(3);
  });

  it.each([401, 403, 404])('is invalid on %i and keeps the provider message', async status => {
    let result = await checkProviderConnection({
      providerSlug: 'xai',
      credentials: { apiKey: 'bad' },
      config: {},
      fetch: respond(status, { error: { message: 'Incorrect API key provided' } })
    });

    expect(result).toEqual({
      outcome: 'invalid',
      httpStatus: status,
      message: 'Incorrect API key provided'
    });
  });

  it.each([429, 500, 503])('is unreachable on %i', async status => {
    let result = await checkProviderConnection({
      providerSlug: 'mistral',
      credentials: { apiKey: 'key' },
      config: {},
      fetch: respond(status, { message: 'slow down' })
    });

    expect(result.outcome).toBe('unreachable');
  });

  it('is unreachable when the request fails', async () => {
    let result = await checkProviderConnection({
      providerSlug: 'groq',
      credentials: { apiKey: 'key' },
      config: {},
      fetch: asFetch(async () => {
        throw new Error('getaddrinfo ENOTFOUND');
      })
    });

    expect(result).toEqual({ outcome: 'unreachable', message: 'getaddrinfo ENOTFOUND' });
  });
});

describe('parseProviderInput', () => {
  it('rejects unsupported providers', () => {
    expect(() => parseProviderInput({ providerSlug: 'openrouter' })).toThrow(/not supported/);
  });

  it('rejects Azure resource names that are not hostnames', () => {
    expect(() =>
      parseProviderInput({
        providerSlug: 'azure',
        credentials: { apiKey: 'key' },
        config: { resourceName: 'evil.example.com/x' }
      })
    ).toThrow(/resource name/);
  });

  it('requires an api key', () => {
    expect(() =>
      parseProviderInput({ providerSlug: 'openai', credentials: {}, config: {} })
    ).toThrow(/credentials/);
  });

  it('accepts config without credentials for updates that keep the stored key', () => {
    let parsed = parseProviderInput({ providerSlug: 'openai', config: {} });

    expect(parsed.credentials).toBeUndefined();
  });
});

describe('supportedProviderSlugs', () => {
  it('uses catalog vendor ids', () => {
    expect(supportedProviderSlugs).toEqual(
      expect.arrayContaining(['openai', 'anthropic', 'google-ai-studio', 'azure', 'together'])
    );
  });
});
