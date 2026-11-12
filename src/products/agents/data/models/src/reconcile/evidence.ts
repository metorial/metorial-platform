import { median } from '../lib/util';
import type { OfferingDecision, OverrideFiles } from '../overrides';
import type { BuildResult } from '../pipeline/build';
import type { CatalogIssue } from '../pipeline/issues';
import type { Model, Offering, SourceKind } from '../types';
import { searchQuery, type WebSearch } from './webSearch';

let candidateLimit = 8;
let descriptionLimit = 600;
let huggingFaceTimeoutMs = 8_000;
let huggingFaceConcurrency = 6;

let stopTokens = new Set(['cf', 'hf', 'chat', 'it', 'latest', 'free', 'model', 'fp8']);

let tokens = (value: string) =>
  new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+|(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])/)
      .filter(token => token && !stopTokens.has(token))
  );

let similarity = (a: Set<string>, b: Set<string>) => {
  let shared = [...a].filter(token => b.has(token)).length;
  return shared ? shared / new Set([...a, ...b]).size : 0;
};

let truncate = (value: unknown) =>
  typeof value === 'string' && value
    ? value.length > descriptionLimit
      ? `${value.slice(0, descriptionLimit)}…`
      : value
    : null;

let listingItems = (raw: unknown) => {
  let data = (raw as { data?: unknown } | null)?.data;
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
};

let listingFor = (rawSources: Map<SourceKind, unknown>, offering: Offering) => {
  let source: SourceKind | null =
    offering.vendorId === 'openrouter'
      ? 'openrouter'
      : offering.vendorId === 'vercel'
        ? 'ai-gateway'
        : null;
  if (!source) return null;

  let item = listingItems(rawSources.get(source)).find(
    entry => entry.id === offering.vendorModelId
  );
  if (!item) return null;

  return {
    source,
    name: item.name ?? null,
    description: truncate(item.description),
    huggingFaceId: item.hugging_face_id || null,
    canonicalSlug: item.canonical_slug ?? null,
    ownedBy: item.owned_by ?? null
  };
};

export let huggingFaceRepo = (vendorModelId: string, listedId: unknown) => {
  if (typeof listedId === 'string' && listedId) return listedId;

  let bare = vendorModelId.replace(/^@(cf|hf)\//, '').replace(/:[\w.-]+$/, '');
  return /^[A-Za-z0-9][\w.-]*\/[\w.-]+$/.test(bare) ? bare : null;
};

let fetchHuggingFace = async (repo: string) => {
  try {
    let response = await fetch(`https://huggingface.co/api/models/${repo}`, {
      headers: { accept: 'application/json', 'user-agent': 'metorial-model-catalog' },
      signal: AbortSignal.timeout(huggingFaceTimeoutMs)
    });
    if (!response.ok) return null;

    let body = (await response.json()) as Record<string, any>;
    return {
      id: body.id ?? repo,
      pipelineTag: body.pipeline_tag ?? null,
      baseModels: ((body.tags ?? []) as string[])
        .filter(tag => tag.startsWith('base_model:'))
        .map(tag => tag.slice('base_model:'.length))
        .slice(0, 6),
      license:
        ((body.tags ?? []) as string[])
          .find(tag => tag.startsWith('license:'))
          ?.slice('license:'.length) ?? null,
      createdAt: body.createdAt ?? null
    };
  } catch {
    return null;
  }
};

let mapLimited = async <T, R>(items: T[], limit: number, run: (item: T) => Promise<R>) => {
  let results: R[] = new Array(items.length);
  let next = 0;

  let worker = async () => {
    while (next < items.length) {
      let index = next++;
      results[index] = await run(items[index]!);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};

let modelSummary = (model: Model, medianInput: number | null) => ({
  id: model.id,
  name: model.name,
  lab: model.labId,
  family: model.familyId,
  kind: model.kind,
  status: model.status,
  releaseDate: model.releaseDate,
  contextTokens: model.limits.contextTokens,
  medianInputPrice: medianInput
});

export let buildEvidence = async (opts: {
  result: BuildResult;
  batch: CatalogIssue[];
  overrides: OverrideFiles;
  fetchHuggingFace: boolean;
  webSearch?: WebSearch | null;
}) => {
  let { catalog, rawSources } = opts.result;
  let offeringsById = new Map(catalog.offerings.map(offering => [offering.id, offering]));
  let vendorsById = new Map(catalog.vendors.map(vendor => [vendor.id, vendor]));
  let modelsById = new Map(catalog.models.map(model => [model.id, model]));

  let pricesByModel = new Map<string, number[]>();
  for (let offering of catalog.offerings) {
    let input = offering.pricing?.text?.input;
    if (!offering.modelId || !input || offering.status === 'retired') continue;
    pricesByModel.set(offering.modelId, [
      ...(pricesByModel.get(offering.modelId) ?? []),
      input
    ]);
  }

  let modelTokens = catalog.models
    .filter(model => model.status !== 'retired')
    .map(model => ({ model, tokens: tokens(`${model.id} ${model.name}`) }));

  let summarize = (model: Model) =>
    modelSummary(model, median(pricesByModel.get(model.id) ?? []) ?? null);

  return mapLimited(opts.batch, huggingFaceConcurrency, async issue => {
    let offering = issue.offeringId ? offeringsById.get(issue.offeringId) : undefined;
    let vendor = vendorsById.get(issue.vendorId);
    let listing = offering ? listingFor(rawSources, offering) : null;
    let repo = huggingFaceRepo(issue.vendorModelId, listing?.huggingFaceId);
    let wanted = tokens(`${issue.vendorModelId} ${offering?.name ?? ''}`);
    let existing: OfferingDecision | null =
      opts.overrides.offerings[issue.vendorId]?.[issue.vendorModelId] ?? null;
    let query = searchQuery(issue.vendorModelId, offering?.name);
    let webResults = opts.webSearch ? await opts.webSearch(query) : null;

    return {
      key: issue.key,
      kind: issue.kind,
      problem: issue.detail,
      file: `overrides/offerings/${issue.vendorId}.json`,
      vendorModelId: issue.vendorModelId,
      vendor: vendor ? { id: vendor.id, name: vendor.name, kind: vendor.kind } : null,
      offering: offering
        ? {
            name: offering.name,
            kind: offering.kind,
            modalities: offering.modalities,
            textPrice: offering.pricing?.text
              ? { input: offering.pricing.text.input, output: offering.pricing.text.output }
              : null,
            contextTokens: offering.limits.contextTokens,
            currentModel: offering.modelId,
            resolvedBy: offering.resolution.method
          }
        : null,
      currentModel:
        offering?.modelId && modelsById.has(offering.modelId)
          ? summarize(modelsById.get(offering.modelId)!)
          : null,
      existingDecision: existing,
      listing,
      huggingFace: opts.fetchHuggingFace && repo ? await fetchHuggingFace(repo) : null,
      webSearch: webResults ? { query, results: webResults } : null,
      candidates: modelTokens
        .map(entry => ({ model: entry.model, score: similarity(wanted, entry.tokens) }))
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score || a.model.id.localeCompare(b.model.id))
        .slice(0, candidateLimit)
        .map(entry => summarize(entry.model))
    };
  });
};

export type IssueEvidence = Awaited<ReturnType<typeof buildEvidence>>[number];

// One line per model, so the agent can grep the whole catalog instead of trusting candidates.
export let modelIndex = (result: BuildResult) =>
  [
    'id\tname\tlab\tkind\tstatus\treleaseDate',
    ...result.catalog.models.map(model =>
      [
        model.id,
        model.name,
        model.labId,
        model.kind,
        model.status,
        model.releaseDate ?? ''
      ].join('\t')
    )
  ].join('\n') + '\n';
