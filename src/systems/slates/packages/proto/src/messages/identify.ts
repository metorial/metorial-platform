import z from 'zod';

export let slatesMessageProviderIdentifyRequest = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.literal('slates/provider.identify'),
  id: z.string(),
  params: z.object({})
});

export type SlatesMessageProviderIdentifyRequest = z.infer<
  typeof slatesMessageProviderIdentifyRequest
>;

export let slatesMessageProviderIdentifyResponse = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.string(),
  result: z.object({
    protocol: z.literal('slates@2026-01-01'),
    provider: z.object({
      type: z.literal('provider'),
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      metadata: z.record(z.string(), z.any()).optional()
    })
  })
});

export type SlatesMessageProviderIdentifyResponse = z.infer<
  typeof slatesMessageProviderIdentifyResponse
>;

export type SlatesIdentifyRequests = SlatesMessageProviderIdentifyRequest;

export type SlatesIdentifyResponses = SlatesMessageProviderIdentifyResponse;

export let slatesIdentifyResponsesByMethod = {
  'slates/provider.identify': slatesMessageProviderIdentifyResponse
};

export let slatesIdentifyRequestsByMethod = {
  'slates/provider.identify': slatesMessageProviderIdentifyRequest
};
