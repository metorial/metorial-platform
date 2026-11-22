import { generateText } from 'ai';
import { describe, expect, it } from 'vitest';
import { createReviewModels, selectReviewModelProvider } from '../src';

let cloudflare = { accountId: 'acct', apiToken: 'cf-token' };
let vercel = { apiKey: 'vercel-key' };

describe('review model providers', () => {
  it('prefers Cloudflare, then Vercel, then nothing', () => {
    expect(selectReviewModelProvider({ cloudflare, vercel })).toBe('cloudflare');
    expect(selectReviewModelProvider({ vercel })).toBe('vercel');
    expect(selectReviewModelProvider({})).toBeNull();
  });

  it('creates no models without a provider', () => {
    expect(createReviewModels({})).toBeNull();
  });

  it('creates Workers AI models through the AI SDK', () => {
    let models = createReviewModels({ cloudflare, vercel })!;

    expect(models.provider).toBe('cloudflare');
    expect(models.fast).toBe(models.balanced);
    expect(models.balanced.slug).toBe('deepseek-v4-1-flash');
    expect(models.balanced.model).toMatchObject({
      modelId: '@cf/deepseek-ai/deepseek-v4.1-flash-1017'
    });
    expect(models.balanced.requestsPerMinute).toBe(18);
    expect(models.balanced.pricing.cacheWritePerMillion).toBe(0);
    expect(models.balanced.fallback?.model).toMatchObject({
      modelId: '@cf/nvidia/nemotron-3-120b-a12b'
    });
    expect(models.balanced.fallback?.requestsPerMinute).toBeUndefined();
  });

  it('pins medium reasoning effort on the balanced Workers AI models', async () => {
    let models = createReviewModels({ cloudflare, vercel })!;
    let seen: unknown[] = [];

    let originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
      seen.push(JSON.parse(init?.body ?? '{}'));
      return new Response('{}', { status: 500 });
    }) as typeof fetch;

    let call = { model: models.balanced.model, prompt: 'hi', maxRetries: 0 };
    try {
      await generateText(call).catch(() => {});
      await generateText({ ...call, reasoning: 'low' }).catch(() => {});
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(models.balanced.reasoningEffort).toBe('medium');
    expect(models.balanced.fallback?.reasoningEffort).toBe('medium');
    expect(seen[0]).toMatchObject({ reasoning_effort: 'medium' });
    expect(seen[1]).toMatchObject({ reasoning_effort: 'low' });
  });

  it('creates gateway models when only Vercel is configured', () => {
    let models = createReviewModels({ vercel })!;

    expect(models.provider).toBe('vercel');
    expect(models.fast.model).toMatchObject({ modelId: 'anthropic/claude-haiku-5.5' });
    expect(models.balanced.model).toMatchObject({ modelId: 'anthropic/claude-sonnet-5.5' });
    expect(models.fast.reasoningEffort).toBeUndefined();
  });
});
