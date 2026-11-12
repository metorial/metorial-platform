import { v } from '@lowerdeck/validation';
import { isPlainObject } from '../lib/util';
import { parseWith } from '../lib/validate';
import { fetchJson, fetchText, loadSource, type LoadSourceOptions } from './fetch';

let cdnBase = 'https://cdn.jsdelivr.net/npm';

// AI SDK provider packages, and the vendor whose model names each one's ModelId unions list.
export let aiSdkPackages: Record<string, string> = {
  anthropic: 'anthropic',
  openai: 'openai',
  google: 'google-ai-studio',
  'google-vertex': 'google-vertex',
  'amazon-bedrock': 'aws-bedrock',
  mistral: 'mistral',
  xai: 'xai',
  deepseek: 'deepseek',
  groq: 'groq',
  cohere: 'cohere',
  fireworks: 'fireworks',
  togetherai: 'together',
  cerebras: 'cerebras',
  perplexity: 'perplexity',
  deepinfra: 'deepinfra',
  alibaba: 'alibaba-cloud',
  moonshotai: 'moonshot'
};

export interface AiSdkPackage {
  name: string;
  version: string;
  modelIds: string[];
}

let packageJsonSchema = v.object({ version: v.string() });

let snapshotSchema = v.object({
  packages: v.array(
    v.object({
      name: v.string(),
      version: v.string(),
      modelIds: v.array(v.string())
    })
  )
});

export let extractModelIds = (dts: string) => {
  let ids = new Set<string>();

  for (let match of dts.matchAll(/type\s+\w*ModelId\s*=\s*([^;]+);/g)) {
    if (match[1]!.trim().startsWith('{')) continue;

    for (let member of match[1]!.split('|')) {
      let literal = member.trim().match(/^'([^']+)'$|^"([^"]+)"$/);
      if (literal) ids.add(literal[1] ?? literal[2]!);
    }
  }

  return [...ids].sort();
};

let fetchPackages = async () => {
  let packages: AiSdkPackage[] = [];

  for (let pkg of Object.keys(aiSdkPackages)) {
    let name = `@ai-sdk/${pkg}`;
    let { version } = parseWith(
      packageJsonSchema,
      await fetchJson(`${cdnBase}/${name}/package.json`),
      name
    );
    let dts = await fetchText(`${cdnBase}/${name}@${version}/dist/index.d.ts`);
    packages.push({ name, version, modelIds: extractModelIds(dts) });
  }

  return { packages };
};

export let parseAiSdk = (raw: unknown) => {
  if (!isPlainObject(raw)) throw new Error('ai-sdk: expected a snapshot object');
  return { data: parseWith(snapshotSchema, raw, 'ai-sdk').packages, issues: [] };
};

export let loadAiSdk = (
  opts: Omit<LoadSourceOptions<AiSdkPackage[]>, 'kind' | 'ref' | 'fetch' | 'parse'>
) =>
  loadSource({
    ...opts,
    kind: 'ai-sdk',
    ref: `${cdnBase}/@ai-sdk/*`,
    fetch: fetchPackages,
    parse: parseAiSdk
  });
