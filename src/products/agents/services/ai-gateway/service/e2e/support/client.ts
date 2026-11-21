import Anthropic from '@anthropic-ai/sdk';
import { rest, rpc } from '@metorial/e2e/api';
import { e2eEndpoint } from '@metorial/e2e/env';
import type { AiGatewayClient } from '@mtsrc/ai-gateway-api-internal';
import OpenAI from 'openai';

let serviceName = '@mtsrc/ai-gateway-service';

export let gateway = rpc<AiGatewayClient>(
  `${e2eEndpoint(serviceName, 'api')}/metorial-ai-gateway`
);

export let apiUrl = () => e2eEndpoint(serviceName, 'api');

export let inferenceUrl = () => e2eEndpoint(serviceName, 'inference');

export let inferenceRest = (secret?: string) => {
  let client = rest(inferenceUrl(), secret ? { apiKey: secret } : {});

  return {
    get: client.get,
    post: (path: string, options: { body?: unknown; headers?: Record<string, string> } = {}) =>
      client.request('POST', path, options)
  };
};

export let openaiClient = (secret: string) =>
  new OpenAI({ apiKey: secret, baseURL: `${inferenceUrl()}/v1`, maxRetries: 0 });

export let anthropicClient = (secret: string) =>
  new Anthropic({ apiKey: secret, baseURL: inferenceUrl(), maxRetries: 0 });

export let anthropicHeaders = { 'anthropic-version': '2023-06-01' };
