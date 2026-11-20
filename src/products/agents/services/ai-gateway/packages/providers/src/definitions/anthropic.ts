import { createAnthropic } from '@ai-sdk/anthropic';
import { APICallError } from '@ai-sdk/provider';
import { v } from '@lowerdeck/validation';
import { defineProvider, lastFourHint } from '../lib/definition';
import { checkModelList } from '../lib/modelList';

let anthropicVersion = '2023-06-01';

export let anthropicBaseUrl = 'https://api.anthropic.com/v1';

let countTokenFields = ['messages', 'system', 'tools', 'tool_choice', 'thinking'];

export let anthropicProvider = defineProvider({
  slug: 'anthropic',
  name: 'Anthropic',
  credentials: v.object({ apiKey: v.string({ modifiers: [v.minLength(1)] }) }),
  config: v.object({}),
  features: ['zdr'],
  credentialHint: credentials => lastFourHint(credentials.apiKey),
  check: async ctx =>
    await checkModelList({
      url: `${anthropicBaseUrl}/models`,
      headers: { 'x-api-key': ctx.credentials.apiKey, 'anthropic-version': anthropicVersion },
      signal: ctx.signal,
      fetch: ctx.fetch
    }),
  languageModel: ctx =>
    createAnthropic({
      apiKey: ctx.credentials.apiKey,
      baseURL: anthropicBaseUrl,
      fetch: ctx.fetch
    })(ctx.modelId),
  countTokens: async ctx => {
    let url = `${anthropicBaseUrl}/messages/count_tokens`;
    let body = {
      ...Object.fromEntries(
        countTokenFields.flatMap(field =>
          field in ctx.body ? [[field, ctx.body[field]]] : []
        )
      ),
      model: ctx.modelId
    };

    let response = await ctx.fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ctx.credentials.apiKey,
        'anthropic-version': anthropicVersion
      },
      body: JSON.stringify(body),
      signal: ctx.signal
    });

    let text = await response.text();
    if (!response.ok) {
      throw new APICallError({
        message: `Anthropic token counting responded with ${response.status}`,
        url,
        requestBodyValues: body,
        statusCode: response.status,
        responseHeaders: Object.fromEntries(response.headers.entries()),
        responseBody: text,
        isRetryable: response.status == 429 || response.status >= 500
      });
    }

    let count = (JSON.parse(text) as { input_tokens?: unknown }).input_tokens;
    if (typeof count != 'number')
      throw new Error('Anthropic token counting returned no count.');

    return count;
  },
  providerOptionsKey: 'anthropic'
});
