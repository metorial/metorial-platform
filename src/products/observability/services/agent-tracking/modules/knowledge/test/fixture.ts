import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { gzipSync } from 'node:zlib';
import { normalizeKey } from '@metorial/model-catalog/src/normalize/parseName';
import type { Catalog, NameTarget, Pricing } from '@metorial/model-catalog/src/types';

export let firstSeenAt = '2026-10-01T00:00:00.000Z';

export let textPricing = (input: number, output = input * 5): Pricing => ({
  currency: 'USD',
  text: { input, output, cacheRead: input / 10, cacheWrite: [], reasoning: null },
  image: null,
  audio: null,
  video: null,
  contextTiers: [],
  units: [],
  webSearchPer1k: null
});

export let organization = (id: string, roles: string[], aliases: string[] = []) => ({
  id,
  name: id,
  roles,
  aliases,
  description: null,
  website: null,
  logo: null,
  country: null,
  status: 'active'
});

export let model = (id: string, labId: string, familyId: string | null) => ({
  id,
  labId,
  familyId,
  name: id,
  description: null,
  kind: 'chat',
  version: null,
  versionSort: [],
  size: null,
  derivedFrom: null,
  status: 'active',
  releaseDate: '2025-09-29',
  knowledgeCutoff: null,
  openWeights: false,
  license: null,
  links: [],
  modalities: { input: ['text', 'image'], output: ['text'] },
  capabilities: {
    tools: true,
    toolChoice: null,
    structuredOutput: true,
    reasoning: null,
    temperature: true,
    promptCaching: null,
    attachments: false
  },
  limits: { contextTokens: 200_000, inputTokens: null, outputTokens: null },
  releaseIds: [],
  latestReleaseId: null,
  offeringCount: 1,
  origin: 'lab-file'
});

export let family = (d: { id: string; labId: string; modelIds: string[] }) => ({
  id: d.id,
  labId: d.labId,
  name: d.id,
  line: null,
  kind: 'chat',
  modelIds: d.modelIds,
  latestModelId: d.modelIds[0] ?? null,
  status: 'active'
});

export let agent = (d: {
  id: string;
  makerId: string;
  aliases?: string[];
  vendorId?: string;
}) => ({
  id: d.id,
  name: d.id,
  makerId: d.makerId,
  description: null,
  website: null,
  docs: null,
  repository: null,
  openSource: false,
  license: null,
  surfaces: ['cli'],
  aliases: d.aliases ?? [],
  vendors: d.vendorId ? [{ vendorId: d.vendorId, role: 'default' }] : [],
  derivedFrom: null,
  status: 'active'
});

export let vendor = (id: string, organizationId: string, kind: string) => ({
  id,
  organizationId,
  name: id,
  kind,
  website: null,
  docs: null,
  logo: null,
  endpointIds: [],
  status: 'active'
});

export let offering = (d: {
  vendorId: string;
  vendorModelId: string;
  modelId: string;
  pricing: Pricing | null;
  firstSeenAt?: string;
}) => ({
  id: `${d.vendorId}:${d.vendorModelId}`,
  vendorId: d.vendorId,
  endpointIds: [],
  vendorModelId: d.vendorModelId,
  name: d.vendorModelId,
  kind: 'model',
  modelId: d.modelId,
  releaseId: null,
  pointerId: null,
  variant: { serving: null, reasoning: null, quantization: null, free: false, region: null },
  status: 'active',
  pricing: d.pricing,
  limits: { contextTokens: null, inputTokens: null, outputTokens: null },
  capabilities: {},
  modalities: { input: ['text'], output: ['text'] },
  apis: [],
  resolution: {},
  sources: ['models.dev'],
  firstSeenAt: d.firstSeenAt ?? firstSeenAt,
  lastSeenAt: '2026-11-01T00:00:00.000Z'
});

export let name = (namespace: string, raw: string, target: NameTarget) => ({
  id: `${namespace}:${raw}`,
  namespace,
  raw,
  key: normalizeKey(raw),
  parsed: {},
  target,
  history: [{ target, from: firstSeenAt, to: null, evidence: 'fixture' }],
  origin: 'observed',
  sources: ['models.dev'],
  status: 'live',
  firstSeenAt,
  lastSeenAt: '2026-11-01T00:00:00.000Z'
});

export let fillerModelIds = Array.from({ length: 8 }, (_, index) => `filler-${index}`);

export let knowledgeCatalog = (
  d: {
    generatedAt?: string;
    sonnetInput?: number;
    gptPricing?: Pricing | null;
    fillerInput?: number;
    extraOfferings?: ReturnType<typeof offering>[];
    extraOrganizations?: ReturnType<typeof organization>[];
    extraFamilies?: ReturnType<typeof family>[];
    extraModels?: ReturnType<typeof model>[];
    extraVendors?: ReturnType<typeof vendor>[];
    extraNames?: ReturnType<typeof name>[];
    extraAgents?: ReturnType<typeof agent>[];
  } = {}
) =>
  ({
    schemaVersion: 1,
    generatedAt: d.generatedAt ?? '2026-11-01T00:00:00.000Z',
    sources: [],
    organizations: [
      organization('anthropic', ['lab', 'vendor', 'agent-maker']),
      organization('openai', ['lab', 'vendor']),
      organization('amazon', ['vendor']),
      ...(d.extraOrganizations ?? [])
    ],
    families: [
      {
        id: 'claude-sonnet',
        labId: 'anthropic',
        name: 'Claude Sonnet',
        line: null,
        kind: 'chat',
        modelIds: ['claude-sonnet-4-5'],
        latestModelId: 'claude-sonnet-4-5',
        status: 'active'
      },
      ...(d.extraFamilies ?? [])
    ],
    models: [
      model('claude-sonnet-4-5', 'anthropic', 'claude-sonnet'),
      model('gpt-5', 'openai', null),
      ...fillerModelIds.map(id => model(id, 'openai', null)),
      ...(d.extraModels ?? [])
    ],
    releases: [],
    pointers: [],
    vendors: [
      vendor('anthropic', 'anthropic', 'first-party'),
      vendor('openai', 'openai', 'first-party'),
      vendor('aws-bedrock', 'amazon', 'cloud'),
      ...(d.extraVendors ?? [])
    ],
    endpoints: [
      {
        id: 'anthropic-api',
        vendorId: 'anthropic',
        name: 'Anthropic API',
        region: null,
        plan: 'payg',
        baseUrl: 'https://api.anthropic.com/v1',
        sdk: null,
        authEnv: [],
        upstreamIds: [],
        status: 'active'
      }
    ],
    offerings: [
      offering({
        vendorId: 'anthropic',
        vendorModelId: 'claude-sonnet-4-5-20250929',
        modelId: 'claude-sonnet-4-5',
        pricing: textPricing(d.sonnetInput ?? 3)
      }),
      offering({
        vendorId: 'openai',
        vendorModelId: 'gpt-5',
        modelId: 'gpt-5',
        pricing: d.gptPricing === undefined ? textPricing(1.25) : d.gptPricing
      }),
      ...fillerModelIds.map(id =>
        offering({
          vendorId: 'openai',
          vendorModelId: id,
          modelId: id,
          pricing: textPricing(d.fillerInput ?? 1)
        })
      ),
      ...(d.extraOfferings ?? [])
    ],
    names: [
      name('vendor:anthropic', 'claude-sonnet-4-5-20250929', {
        kind: 'model',
        modelId: 'claude-sonnet-4-5'
      }),
      name('vendor:openai', 'gpt-5', { kind: 'model', modelId: 'gpt-5' }),
      name('display', 'Claude Sonnet 4.5', { kind: 'model', modelId: 'claude-sonnet-4-5' }),
      ...(d.extraNames ?? [])
    ],
    agents: [
      {
        id: 'claude-code',
        name: 'Claude Code',
        makerId: 'anthropic',
        description: null,
        website: null,
        docs: null,
        repository: null,
        openSource: false,
        license: null,
        surfaces: ['cli'],
        aliases: ['claude_code'],
        vendors: [{ vendorId: 'anthropic', role: 'default' }],
        derivedFrom: null,
        status: 'active'
      },
      ...(d.extraAgents ?? [])
    ]
  }) as unknown as Catalog;

export type KnowledgeFixtureServer = {
  url: string;
  requests: string[];
  publish: (catalog: Catalog, fingerprint: string) => void;
  onArchive: (handler: (() => void) | null) => void;
  close: () => Promise<void>;
};

export let startKnowledgeServer = async (): Promise<KnowledgeFixtureServer> => {
  let state = {
    fingerprint: '',
    etag: '',
    archive: Buffer.alloc(0),
    onArchive: null as (() => void) | null
  };
  let requests: string[] = [];

  let server: Server = createServer((request, response) => {
    requests.push(`${request.method} ${request.url}`);

    if (request.url == '/fingerprint.json') {
      if (request.headers['if-none-match'] == state.etag) {
        response.writeHead(304);
        response.end();
        return;
      }

      response.writeHead(200, { etag: state.etag, 'content-type': 'application/json' });
      response.end(JSON.stringify({ fingerprint: state.fingerprint }));
      return;
    }

    if (request.url == '/catalog.json.gz') {
      state.onArchive?.();
      response.writeHead(200, { 'content-type': 'application/gzip' });
      response.end(state.archive);
      return;
    }

    response.writeHead(404);
    response.end();
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  let { port } = server.address() as AddressInfo;

  let publish = (catalog: Catalog, fingerprint: string) => {
    state.fingerprint = fingerprint;
    state.etag = `"${fingerprint}"`;
    state.archive = gzipSync(JSON.stringify(catalog));
  };

  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    publish,
    onArchive: handler => {
      state.onArchive = handler;
    },
    close: () => new Promise<void>(resolve => server.close(() => resolve()))
  };
};
