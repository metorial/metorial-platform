import { v, type ValidationTypeValue } from '@lowerdeck/validation';
import { parseWith } from '../lib/validate';
import { fetchJson, loadSource, parseItems, type LoadSourceOptions } from './fetch';

let modelsUrl = 'https://ai-gateway.vercel.sh/v1/models';

let price = v.union([v.string(), v.number()]);

let gatewayModelSchema = v.object({
  id: v.string(),
  name: v.optional(v.nullable(v.string())),
  type: v.optional(v.nullable(v.string())),
  owned_by: v.optional(v.nullable(v.string())),
  context_window: v.optional(v.nullable(v.number())),
  max_tokens: v.optional(v.nullable(v.number())),
  tags: v.optional(v.nullable(v.array(v.string()))),
  supported_parameters: v.optional(v.nullable(v.array(v.string()))),
  modalities: v.optional(
    v.nullable(
      v.object({
        input: v.optional(v.nullable(v.array(v.string()))),
        output: v.optional(v.nullable(v.array(v.string())))
      })
    )
  ),
  pricing: v.optional(
    v.nullable(
      v.object({
        input: v.optional(v.nullable(price)),
        output: v.optional(v.nullable(price)),
        input_cache_read: v.optional(v.nullable(price)),
        input_cache_write: v.optional(v.nullable(price)),
        web_search: v.optional(v.nullable(price))
      })
    )
  )
});

export type GatewayModel = ValidationTypeValue<typeof gatewayModelSchema>;

let envelope = v.object({ data: v.array(v.any()) });

export let parseAiGateway = (raw: unknown) => {
  let { data } = parseWith(envelope, raw, 'ai-gateway');
  return parseItems(
    data,
    item => parseWith(gatewayModelSchema, item, 'ai-gateway model'),
    (item, index) => `ai-gateway ${(item as any)?.id ?? index}`
  );
};

export let loadAiGateway = (
  opts: Omit<LoadSourceOptions<GatewayModel[]>, 'kind' | 'ref' | 'fetch' | 'parse'>
) =>
  loadSource({
    ...opts,
    kind: 'ai-gateway',
    ref: modelsUrl,
    fetch: () => fetchJson(modelsUrl),
    parse: parseAiGateway
  });
