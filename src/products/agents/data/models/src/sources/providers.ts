import { ExtractionError } from '../lib/extraction';
import type { SourceKind } from '../types';
import { parseAnthropic } from './anthropic';
import { parseCerebras } from './cerebras';
import { parseDeepInfra } from './deepinfra';
import { parseDeepSeek } from './deepseek';
import type { LoadSourceOptions, ParsedSource } from './fetch';
import { fetchJson, fetchText, loadSource } from './fetch';
import { parseFireworks } from './fireworks';
import { parseGoogle } from './google-ai-studio';
import { parseGroq } from './groq';
import { parseHuggingFace } from './huggingface';
import { parseLlmGateway } from './llmgateway';
import { fetchMistral, parseMistral } from './mistral';
import { parseNovita } from './novita';
import { parseOpenAi } from './openai';
import { parsePerplexity } from './perplexity';
import { extractPrices, type PublishedPrice } from './pricing';
import { parseTogether } from './together';
import { parseVenice } from './venice';
import { parseXai } from './xai';
import { parseZai } from './zai';

type JsonPricingProvider =
  'cerebras' | 'deepinfra' | 'novita' | 'huggingface' | 'llmgateway' | 'venice';

type DocumentPricingProvider =
  'together' | 'xai' | 'zai' | 'fireworks' | 'groq' | 'perplexity';

export interface PricingFailure {
  source: SourceKind;
  raw: unknown;
  problems: string[];
}

export class PricingExtractionError extends ExtractionError {
  constructor(public failures: PricingFailure[]) {
    super(
      'pricing',
      failures.flatMap(failure =>
        failure.problems.map(problem => `${failure.source}: ${problem}`)
      )
    );
  }
}

export interface PricingSource {
  kind: SourceKind;
  vendorId: string;
  file: string;
  exportName: string;
  ref: string;
  fetch: () => Promise<unknown>;
  parse: (raw: unknown, now: string) => ParsedSource<PublishedPrice[]>;
}

let providerParsers = {
  cerebras: parseCerebras,
  deepinfra: parseDeepInfra,
  novita: parseNovita,
  huggingface: parseHuggingFace,
  llmgateway: parseLlmGateway,
  venice: parseVenice,
  together: parseTogether,
  xai: parseXai,
  zai: parseZai,
  fireworks: parseFireworks,
  groq: parseGroq,
  perplexity: parsePerplexity
};

let parserNames = {
  cerebras: 'parseCerebras',
  deepinfra: 'parseDeepInfra',
  novita: 'parseNovita',
  huggingface: 'parseHuggingFace',
  llmgateway: 'parseLlmGateway',
  venice: 'parseVenice',
  together: 'parseTogether',
  xai: 'parseXai',
  zai: 'parseZai',
  fireworks: 'parseFireworks',
  groq: 'parseGroq',
  perplexity: 'parsePerplexity'
};

let jsonSource = (
  kind: JsonPricingProvider,
  vendorId: string,
  ref: string
): PricingSource => ({
  kind,
  vendorId,
  ref,
  file: `src/sources/${kind}/index.ts`,
  exportName: parserNames[kind],
  fetch: () => fetchJson(ref),
  parse: providerParsers[kind]
});

let documentSource = (
  kind: DocumentPricingProvider,
  vendorId: string,
  ref: string
): PricingSource => ({
  kind,
  vendorId,
  ref,
  file: `src/sources/${kind}/index.ts`,
  exportName: parserNames[kind],
  fetch: () => fetchText(ref),
  parse: providerParsers[kind]
});

export let pricingSources: PricingSource[] = [
  {
    kind: 'openai',
    file: 'src/sources/openai/index.ts',
    exportName: 'parseOpenAi',
    vendorId: 'openai',
    ref: 'https://developers.openai.com/api/docs/pricing.md',
    fetch: () => fetchText('https://developers.openai.com/api/docs/pricing.md'),
    parse: parseOpenAi
  },
  {
    kind: 'anthropic',
    file: 'src/sources/anthropic/index.ts',
    exportName: 'parseAnthropic',
    vendorId: 'anthropic',
    ref: 'https://platform.claude.com/docs/en/about-claude/pricing.md',
    fetch: () => fetchText('https://platform.claude.com/docs/en/about-claude/pricing.md'),
    parse: parseAnthropic
  },
  jsonSource('cerebras', 'cerebras', 'https://api.cerebras.ai/public/v1/models'),
  jsonSource('deepinfra', 'deepinfra', 'https://api.deepinfra.com/models/list'),
  jsonSource('novita', 'novita-ai', 'https://api.novita.ai/v3/openai/models'),
  jsonSource('huggingface', 'huggingface', 'https://router.huggingface.co/v1/models'),
  jsonSource('llmgateway', 'llmgateway', 'https://api.llmgateway.io/v1/models?mapped=true'),
  jsonSource('venice', 'venice', 'https://api.venice.ai/api/v1/models?type=all'),
  documentSource('together', 'together', 'https://docs.together.ai/docs/serverless/models.md'),
  documentSource('xai', 'xai', 'https://docs.x.ai/developers/pricing.md'),
  documentSource('zai', 'zhipu', 'https://docs.z.ai/guides/overview/pricing.md'),
  documentSource('fireworks', 'fireworks', 'https://docs.fireworks.ai/serverless/pricing.md'),
  documentSource('groq', 'groq', 'https://console.groq.com/docs/models.md'),
  documentSource(
    'perplexity',
    'perplexity',
    'https://docs.perplexity.ai/docs/agent-api/models.md'
  ),
  {
    kind: 'mistral',
    file: 'src/sources/mistral/index.ts',
    exportName: 'parseMistral',
    vendorId: 'mistral',
    ref: 'https://docs.mistral.ai/models.md',
    fetch: fetchMistral,
    parse: parseMistral
  },
  {
    kind: 'deepseek',
    file: 'src/sources/deepseek/index.ts',
    exportName: 'parseDeepSeek',
    vendorId: 'deepseek',
    ref: 'https://api-docs.deepseek.com/quick_start/pricing/',
    fetch: () => fetchText('https://api-docs.deepseek.com/quick_start/pricing/'),
    parse: parseDeepSeek
  },
  {
    kind: 'google-ai-studio',
    file: 'src/sources/google-ai-studio/index.ts',
    exportName: 'parseGoogle',
    vendorId: 'google-ai-studio',
    ref: 'https://aistudio.google.com/docs/pricing.md',
    fetch: () => fetchText('https://aistudio.google.com/docs/pricing.md'),
    parse: parseGoogle
  }
];

export let loadPricingSources = async (
  opts: Omit<LoadSourceOptions<PublishedPrice[]>, 'kind' | 'ref' | 'fetch' | 'parse'>
) => {
  let failures: PricingFailure[] = [];
  let results = await Promise.all(
    pricingSources.map(async source => {
      let observed: unknown;
      try {
        return await loadSource({
          ...opts,
          kind: source.kind,
          ref: source.ref,
          fetch: source.fetch,
          parse: raw => {
            observed = raw;
            return extractPrices(source.kind, () => source.parse(raw, opts.now));
          }
        });
      } catch (error) {
        if (!(error instanceof ExtractionError)) throw error;
        failures.push({ source: source.kind, raw: observed, problems: error.problems });
        return null;
      }
    })
  );
  if (failures.length) throw new PricingExtractionError(failures);
  return results.filter(result => result !== null);
};
