import { v, type ValidationTypeValue } from '@lowerdeck/validation';
import { parseWith } from '../lib/validate';
import { fetchJson, loadSource, parseItems, type LoadSourceOptions } from './fetch';

let modelsUrl = 'https://openrouter.ai/api/v1/models';

let price = v.union([v.string(), v.number()]);

let openRouterModelSchema = v.object({
  id: v.string(),
  canonical_slug: v.optional(v.nullable(v.string())),
  hugging_face_id: v.optional(v.nullable(v.string())),
  name: v.optional(v.nullable(v.string())),
  description: v.optional(v.nullable(v.string())),
  context_length: v.optional(v.nullable(v.number())),
  architecture: v.optional(
    v.nullable(
      v.object({
        input_modalities: v.optional(v.nullable(v.array(v.string()))),
        output_modalities: v.optional(v.nullable(v.array(v.string())))
      })
    )
  ),
  pricing: v.optional(
    v.nullable(
      v.object({
        prompt: v.optional(v.nullable(price)),
        completion: v.optional(v.nullable(price)),
        input_cache_read: v.optional(v.nullable(price)),
        input_cache_write: v.optional(v.nullable(price)),
        internal_reasoning: v.optional(v.nullable(price)),
        web_search: v.optional(v.nullable(price)),
        image: v.optional(v.nullable(price))
      })
    )
  ),
  top_provider: v.optional(
    v.nullable(v.object({ max_completion_tokens: v.optional(v.nullable(v.number())) }))
  ),
  supported_parameters: v.optional(v.nullable(v.array(v.string()))),
  endpoints: v.optional(v.nullable(v.array(v.string()))),
  reasoning: v.optional(
    v.nullable(
      v.object({
        mandatory: v.optional(v.nullable(v.boolean())),
        supported_efforts: v.optional(v.nullable(v.array(v.string())))
      })
    )
  ),
  expiration_date: v.optional(v.nullable(v.string()))
});

export type OpenRouterModel = ValidationTypeValue<typeof openRouterModelSchema>;

let envelope = v.object({ data: v.array(v.any()) });

export let parseOpenRouter = (raw: unknown) => {
  let { data } = parseWith(envelope, raw, 'openrouter');
  return parseItems(
    data,
    item => parseWith(openRouterModelSchema, item, 'openrouter model'),
    (item, index) => `openrouter ${(item as any)?.id ?? index}`
  );
};

export let loadOpenRouter = (
  opts: Omit<LoadSourceOptions<OpenRouterModel[]>, 'kind' | 'ref' | 'fetch' | 'parse'>
) =>
  loadSource({
    ...opts,
    kind: 'openrouter',
    ref: modelsUrl,
    fetch: () => fetchJson(modelsUrl),
    parse: parseOpenRouter
  });
