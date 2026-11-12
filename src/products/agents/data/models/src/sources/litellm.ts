import { v } from '@lowerdeck/validation';
import { isPlainObject } from '../lib/util';
import { parseWith } from '../lib/validate';
import { fetchJson, loadSource, type LoadSourceOptions } from './fetch';

let pricesUrl =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

let entrySchema = v.object({
  litellm_provider: v.optional(v.string()),
  mode: v.optional(v.string())
});

export interface LiteLlmEntry {
  key: string;
  provider: string | null;
  mode: string | null;
}

export let parseLiteLlm = (raw: unknown) => {
  if (!isPlainObject(raw)) throw new Error('litellm: expected an object of model entries');

  let data: LiteLlmEntry[] = [];
  let issues: string[] = [];

  for (let [key, value] of Object.entries(raw)) {
    if (key === 'sample_spec' || !isPlainObject(value)) continue;

    try {
      let entry = parseWith(entrySchema, value, `litellm ${key}`);
      data.push({ key, provider: entry.litellm_provider ?? null, mode: entry.mode ?? null });
    } catch (err) {
      issues.push((err as Error).message);
    }
  }

  return { data, issues };
};

export let loadLiteLlm = (
  opts: Omit<LoadSourceOptions<LiteLlmEntry[]>, 'kind' | 'ref' | 'fetch' | 'parse'>
) =>
  loadSource({
    ...opts,
    kind: 'litellm',
    ref: pricesUrl,
    fetch: () => fetchJson(pricesUrl),
    parse: parseLiteLlm
  });
