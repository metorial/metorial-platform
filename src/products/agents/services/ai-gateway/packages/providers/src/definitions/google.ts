import { createGoogle } from '@ai-sdk/google';
import { v } from '@lowerdeck/validation';
import { defineProvider, lastFourHint } from '../lib/definition';
import { checkModelList } from '../lib/modelList';

let baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

export let googleAiStudioProvider = defineProvider({
  slug: 'google-ai-studio',
  name: 'Google AI Studio',
  credentials: v.object({ apiKey: v.string({ modifiers: [v.minLength(1)] }) }),
  config: v.object({}),
  features: [],
  credentialHint: credentials => lastFourHint(credentials.apiKey),
  check: async ctx =>
    await checkModelList({
      url: `${baseUrl}/models?pageSize=1000`,
      headers: { 'x-goog-api-key': ctx.credentials.apiKey },
      signal: ctx.signal,
      fetch: ctx.fetch
    }),
  languageModel: ctx =>
    createGoogle({ apiKey: ctx.credentials.apiKey, baseURL: baseUrl, fetch: ctx.fetch })(
      ctx.modelId
    ),
  providerOptionsKey: 'google'
});
