import { uniq } from '../lib/util';
import { normalizeKey, parseName } from '../normalize/parseName';
import { labVariantSuffixes } from '../registry/labProfiles';
import { aiSdkPackages, type AiSdkPackage } from '../sources/aiSdk';
import type { LiteLlmEntry } from '../sources/litellm';
import type { OpenRouterModel } from '../sources/openrouter';
import type { Model, Name, NameTarget, Offering, SourceKind } from '../types';
import type { CanonicalCatalog } from './canonicalize';
import type { OrganizationIndex } from './organizations';
import type { Resolver } from './resolver';
import type { VendorIndex } from './vendors';

let litellmVendors: Record<string, string> = {
  anthropic: 'anthropic',
  openai: 'openai',
  'text-completion-openai': 'openai',
  gemini: 'google-ai-studio',
  bedrock: 'aws-bedrock',
  bedrock_converse: 'aws-bedrock',
  azure: 'azure',
  azure_ai: 'azure',
  mistral: 'mistral',
  codestral: 'mistral',
  xai: 'xai',
  deepseek: 'deepseek',
  groq: 'groq',
  together_ai: 'together',
  fireworks_ai: 'fireworks',
  cerebras: 'cerebras',
  deepinfra: 'deepinfra',
  perplexity: 'perplexity',
  cohere: 'cohere',
  cohere_chat: 'cohere',
  vercel_ai_gateway: 'vercel-ai-gateway',
  moonshot: 'moonshot',
  zai: 'zhipu',
  dashscope: 'alibaba-cloud',
  volcengine: 'volcengine',
  minimax: 'minimax',
  xiaomi_mimo: 'xiaomi',
  nvidia_nim: 'nvidia',
  watsonx: 'ibm-watsonx',
  oci: 'oracle-oci',
  snowflake: 'snowflake-cortex',
  databricks: 'databricks',
  sambanova: 'sambanova',
  nebius: 'nebius',
  ovhcloud: 'ovhcloud',
  scaleway: 'scaleway',
  github_copilot: 'github-copilot'
};

let litellmRoutes = new Set([
  ...Object.keys(litellmVendors),
  'vertex_ai',
  'openrouter',
  'bedrock_mantle',
  'sagemaker',
  'replicate',
  'ollama',
  'huggingface'
]);

let awsRegion = /^[a-z]{2}(-gov)?-[a-z]+-\d$/;

export let litellmVendorFor = (provider: string | null) => {
  if (!provider) return null;
  if (provider.startsWith('vertex_ai')) return 'google-vertex';
  return litellmVendors[provider] ?? null;
};

export let stripLitellmRoute = (key: string) => {
  let segments = key.split('/');
  if (segments.length > 1 && litellmRoutes.has(segments[0]!)) segments.shift();
  if (segments.length > 1 && awsRegion.test(segments[0]!)) segments.shift();
  return segments.join('/');
};

export let offeringTarget = (offering: Offering): NameTarget => {
  if (offering.kind === 'router') return { kind: 'router' };
  if (offering.pointerId) return { kind: 'pointer', pointerId: offering.pointerId };
  if (offering.releaseId && offering.modelId)
    return { kind: 'release', releaseId: offering.releaseId, modelId: offering.modelId };
  if (offering.modelId) return { kind: 'model', modelId: offering.modelId };
  return { kind: 'unresolved' };
};

export interface NameInputs {
  catalog: CanonicalCatalog;
  offerings: Map<string, Offering>;
  orgs: OrganizationIndex;
  vendors: VendorIndex;
  resolver: Resolver;
  litellm: LiteLlmEntry[] | null;
  aiSdk: AiSdkPackage[] | null;
  openrouter: OpenRouterModel[] | null;
  now: string;
}

export let buildNames = (inputs: NameInputs) => {
  let names = new Map<string, Name>();
  let parseOpts = { resolveOrg: inputs.orgs.resolveLab, labVariantSuffixes };

  let add = (
    namespace: string,
    raw: string,
    target: NameTarget,
    source: SourceKind | null
  ) => {
    let id = `${namespace}:${raw}`;
    let existing = names.get(id);

    if (existing) {
      if (source)
        existing.sources = uniq([...existing.sources, source]).sort() as SourceKind[];
      if (existing.target.kind === 'unresolved' && target.kind !== 'unresolved')
        existing.target = target;
      return;
    }

    names.set(id, {
      id,
      namespace,
      raw,
      key: normalizeKey(raw),
      parsed: parseName(raw, parseOpts),
      target,
      history: [],
      origin: 'observed',
      sources: source ? [source] : [],
      status: 'live',
      firstSeenAt: inputs.now,
      lastSeenAt: inputs.now
    });
  };

  let { catalog } = inputs;

  for (let model of catalog.models.values())
    add('metorial', model.id, { kind: 'model', modelId: model.id }, null);
  for (let release of catalog.releases.values())
    add(
      'metorial',
      release.id,
      { kind: 'release', releaseId: release.id, modelId: release.modelId },
      null
    );
  for (let pointer of catalog.pointers.values())
    add('metorial', pointer.id, { kind: 'pointer', pointerId: pointer.id }, null);

  for (let file of catalog.sourceFiles) {
    if (file.origin !== 'lab-file') continue;
    let target = catalog.upstreamTargets.get(file.upstreamKey);
    if (target) add('catalog:models.dev', file.upstreamKey, target, 'models.dev');
  }

  for (let offering of inputs.offerings.values())
    for (let source of offering.sources)
      add(
        `vendor:${offering.vendorId}`,
        offering.vendorModelId,
        offeringTarget(offering),
        source
      );

  let byDisplayName = new Map<string, Model[]>();
  for (let model of catalog.models.values()) {
    let list = byDisplayName.get(model.name) ?? [];
    list.push(model);
    byDisplayName.set(model.name, list);
  }
  for (let [displayName, models] of byDisplayName)
    if (models.length === 1)
      add('display', displayName, { kind: 'model', modelId: models[0]!.id }, null);

  for (let model of catalog.models.values()) {
    for (let link of model.links) {
      let match = link.url.match(/^https:\/\/huggingface\.co\/([^/]+\/[^/?#]+)/);
      if (match)
        add(
          'catalog:huggingface',
          match[1]!,
          { kind: 'model', modelId: model.id },
          'models.dev'
        );
    }
  }

  for (let model of inputs.openrouter ?? []) {
    let offering = [...inputs.offerings.values()].find(
      candidate => candidate.vendorId === 'openrouter' && candidate.vendorModelId === model.id
    );
    if (model.hugging_face_id && offering)
      add(
        'catalog:huggingface',
        model.hugging_face_id,
        offeringTarget(offering),
        'openrouter'
      );
  }

  for (let pkg of inputs.aiSdk ?? []) {
    let vendorId = aiSdkPackages[pkg.name.replace(/^@ai-sdk\//, '')] ?? null;
    for (let modelId of pkg.modelIds) {
      let resolution = inputs.resolver.resolve({ vendorId, vendorModelId: modelId });
      add(`sdk:${pkg.name}`, modelId, resolution.target, 'ai-sdk');
    }
  }

  for (let entry of inputs.litellm ?? []) {
    let vendorId = litellmVendorFor(entry.provider);
    let vendorModelId = stripLitellmRoute(entry.key);
    let resolution = inputs.resolver.resolve({ vendorId, vendorModelId });

    add('catalog:litellm', entry.key, resolution.target, 'litellm');
    if (vendorId && inputs.vendors.vendors.has(vendorId))
      add(`vendor:${vendorId}`, vendorModelId, resolution.target, 'litellm');
  }

  return names;
};
