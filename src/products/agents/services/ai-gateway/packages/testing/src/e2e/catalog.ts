import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { gzipSync } from 'node:zlib';

let capabilities = {
  tools: true,
  toolChoice: null,
  structuredOutput: true,
  reasoning: null,
  temperature: true,
  promptCaching: null,
  attachments: false
};

let variant = {
  serving: null,
  reasoning: null,
  quantization: null,
  free: false,
  region: null
};

let pricing = {
  currency: 'USD',
  text: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: [], reasoning: null },
  image: null,
  audio: null,
  video: null,
  contextTiers: [],
  units: [],
  webSearchPer1k: null
};

let organization = (id: string, name: string) => ({
  id,
  name,
  roles: ['lab'],
  aliases: [],
  description: null,
  website: null,
  logo: null,
  country: null,
  status: 'active'
});

let model = (id: string, labId: string, name: string) => ({
  id,
  labId,
  familyId: null,
  name,
  description: null,
  kind: 'chat',
  version: null,
  versionSort: [],
  size: null,
  derivedFrom: null,
  status: 'active',
  releaseDate: '2026-01-15',
  knowledgeCutoff: null,
  openWeights: false,
  license: null,
  links: [],
  modalities: { input: ['text'], output: ['text'] },
  capabilities,
  limits: { contextTokens: 200_000, inputTokens: null, outputTokens: 64_000 },
  releaseIds: [],
  latestReleaseId: null,
  offeringCount: 1,
  origin: 'lab-file'
});

let vendor = (id: string, name: string) => ({
  id,
  organizationId: id,
  name,
  kind: 'first-party',
  website: null,
  docs: null,
  logo: null,
  endpointIds: [],
  status: 'active'
});

let offering = (d: { vendorId: string; vendorModelId: string; modelId: string }) => ({
  id: `${d.vendorId}:${d.vendorModelId}`,
  vendorId: d.vendorId,
  endpointIds: [],
  vendorModelId: d.vendorModelId,
  name: d.vendorModelId,
  kind: 'model',
  modelId: d.modelId,
  releaseId: null,
  pointerId: null,
  variant,
  status: 'active',
  pricing,
  limits: { contextTokens: null, inputTokens: 100_000, outputTokens: 8_000 },
  capabilities,
  modalities: { input: ['text'], output: ['text'] },
  apis: ['messages'],
  resolution: { method: 'first-party', upstreamCanonicalId: null, overrideId: null },
  sources: [],
  firstSeenAt: '2026-01-01T00:00:00Z',
  lastSeenAt: '2026-01-01T00:00:00Z'
});

let name = (id: string, namespace: string, raw: string, modelId: string) => ({
  id,
  namespace,
  raw,
  key: raw.toLowerCase(),
  target: { kind: 'model', modelId },
  status: 'live'
});

export let catalogModels = {
  sonnet: 'anthropic/claude-sonnet-5',
  haiku: 'anthropic/claude-haiku-5',
  gpt: 'openai/gpt-6'
} as const;

export let catalogLabs = ['anthropic', 'openai'] as const;

export let catalogProviders = ['anthropic', 'openai'] as const;

let catalog = {
  schemaVersion: 1,
  generatedAt: '2026-11-20T00:00:00Z',
  sources: [],
  organizations: [organization('anthropic', 'Anthropic'), organization('openai', 'OpenAI')],
  families: [],
  models: [
    model(catalogModels.sonnet, 'anthropic', 'Claude Sonnet 5'),
    model(catalogModels.haiku, 'anthropic', 'Claude Haiku 5'),
    model(catalogModels.gpt, 'openai', 'GPT 6')
  ],
  releases: [],
  pointers: [],
  vendors: [vendor('anthropic', 'Anthropic'), vendor('openai', 'OpenAI')],
  endpoints: [],
  offerings: [
    offering({
      vendorId: 'anthropic',
      vendorModelId: 'claude-sonnet-5',
      modelId: catalogModels.sonnet
    }),
    offering({
      vendorId: 'anthropic',
      vendorModelId: 'claude-haiku-5',
      modelId: catalogModels.haiku
    }),
    offering({ vendorId: 'openai', vendorModelId: 'gpt-6', modelId: catalogModels.gpt })
  ],
  names: [
    name('n1', 'metorial', catalogModels.sonnet, catalogModels.sonnet),
    name('n2', 'metorial', catalogModels.haiku, catalogModels.haiku),
    name('n3', 'metorial', catalogModels.gpt, catalogModels.gpt),
    name('n4', 'display', 'Claude Sonnet 5', catalogModels.sonnet),
    name('n5', 'display', 'Claude Haiku 5', catalogModels.haiku),
    name('n6', 'display', 'GPT 6', catalogModels.gpt),
    name('n7', 'vendor:anthropic', 'claude-sonnet-latest', catalogModels.sonnet),
    name('n8', 'vendor:anthropic', 'claude-haiku-latest', catalogModels.haiku)
  ]
};

export let catalogArchive = gzipSync(JSON.stringify(catalog));

export let catalogFingerprint = `e2e-${createHash('sha256').update(catalogArchive).digest('hex').slice(0, 16)}`;

export let catalogFingerprintFile = JSON.stringify({
  fingerprint: catalogFingerprint,
  generatedAt: catalog.generatedAt
});

export let defaultCatalogPort = 52199;

export let serveCatalog = async (port = defaultCatalogPort) => {
  let server = createServer((request, response) => {
    if (request.url === '/fingerprint.json') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(catalogFingerprintFile);
    } else if (request.url === '/catalog.json.gz') {
      response.writeHead(200, { 'content-type': 'application/gzip' });
      response.end(catalogArchive);
    } else {
      response.writeHead(404);
      response.end();
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });

  return { close: () => closeServer(server) };
};

export let closeServer = (server: Server) =>
  new Promise<void>(resolve => {
    server.closeAllConnections();
    server.close(() => resolve());
  });
