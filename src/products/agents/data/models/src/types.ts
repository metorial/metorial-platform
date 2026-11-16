export type OrganizationId = string;
export type FamilyId = string;
export type ModelId = string;
export type ReleaseId = string;
export type PointerId = string;
export type VendorId = string;
export type EndpointId = string;
export type OfferingId = string;
export type NameId = string;
export type AgentId = string;

export type IsoDate = string;
export type IsoDateTime = string;

export interface Catalog {
  schemaVersion: 1;
  generatedAt: IsoDateTime;
  sources: CatalogSource[];

  organizations: Organization[];
  families: Family[];
  models: Model[];
  releases: Release[];
  pointers: Pointer[];
  vendors: Vendor[];
  endpoints: Endpoint[];
  offerings: Offering[];
  names: Name[];
  agents: Agent[];
}

export type SourceKind =
  | 'models.dev'
  | 'openrouter'
  | 'ai-gateway'
  | 'litellm'
  | 'ai-sdk'
  | 'openai'
  | 'anthropic'
  | 'cerebras'
  | 'deepinfra'
  | 'novita'
  | 'huggingface'
  | 'llmgateway'
  | 'venice'
  | 'together'
  | 'xai'
  | 'zai'
  | 'fireworks'
  | 'groq'
  | 'perplexity'
  | 'mistral'
  | 'deepseek'
  | 'google-ai-studio';

export interface CatalogSource {
  kind: SourceKind;
  ref: string;
  fetchedAt: IsoDateTime;
  status: 'fresh' | 'fallback' | 'missing';
  error: string | null;
}

export type OrganizationRole = 'lab' | 'vendor' | 'agent-maker';

export interface Organization {
  id: OrganizationId;
  name: string;
  roles: OrganizationRole[];
  aliases: string[];
  description: string | null;
  website: string | null;
  logo: string | null;
  country: string | null;
  status: 'active' | 'retired';
}

export type ModelKind =
  | 'chat'
  | 'embedding'
  | 'reranking'
  | 'image'
  | 'video'
  | 'speech'
  | 'transcription'
  | 'realtime'
  | 'audio'
  | 'decision'
  | 'other';

export type LifecycleStatus = 'preview' | 'active' | 'deprecated' | 'retired';

export interface Family {
  id: FamilyId;
  labId: OrganizationId;
  name: string;
  line: string | null;
  kind: ModelKind;
  modelIds: ModelId[];
  latestModelId: ModelId | null;
  status: 'active' | 'retired';
}

export interface ModelSize {
  totalParams: number | null;
  activeParams: number | null;
  label: string;
}

export interface Model {
  id: ModelId;
  labId: OrganizationId;
  familyId: FamilyId | null;
  name: string;
  description: string | null;
  kind: ModelKind;

  version: string | null;
  versionSort: number[];
  size: ModelSize | null;
  derivedFrom: ModelId | null;

  status: LifecycleStatus;
  releaseDate: IsoDate | null;
  knowledgeCutoff: string | null;
  openWeights: boolean;
  license: string | null;
  links: Link[];

  modalities: Modalities;
  capabilities: Capabilities;
  limits: Limits;

  releaseIds: ReleaseId[];
  latestReleaseId: ReleaseId | null;
  offeringCount: number;
  origin: 'lab-file' | 'first-party-inline' | 'override';
}

export interface Release {
  id: ReleaseId;
  modelId: ModelId;
  date: IsoDate;
  status: LifecycleStatus;
}

export type NameTarget =
  | { kind: 'release'; releaseId: ReleaseId; modelId: ModelId }
  | { kind: 'model'; modelId: ModelId }
  | { kind: 'pointer'; pointerId: PointerId }
  | { kind: 'router' }
  | { kind: 'unresolved' };

export interface TargetPeriod {
  target: NameTarget;
  from: IsoDateTime;
  to: IsoDateTime | null;
  evidence: string;
}

export interface Pointer {
  id: PointerId;
  labId: OrganizationId;
  familyId: FamilyId | null;
  target: NameTarget;
  history: TargetPeriod[];
  evidence: string;
}

export type Modality = 'text' | 'image' | 'audio' | 'video' | 'pdf' | 'file';

export interface Modalities {
  input: Modality[];
  output: Modality[];
}

export type ReasoningEffort = string;

export interface Capabilities {
  tools: boolean;
  toolChoice: string[] | null;
  structuredOutput: boolean;
  reasoning: ReasoningCapability | null;
  temperature: boolean;
  promptCaching: CachingCapability | null;
  attachments: boolean;
}

export interface ReasoningCapability {
  toggle: boolean;
  effort: ReasoningEffort[] | null;
}

export interface CachingCapability {
  implicit: boolean;
  explicit: boolean;
  ttls: string[];
}

export interface Limits {
  contextTokens: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface Link {
  label: string;
  url: string;
}

export type VendorKind = 'first-party' | 'cloud' | 'inference' | 'aggregator' | 'subscription';

export interface Vendor {
  id: VendorId;
  organizationId: OrganizationId;
  name: string;
  kind: VendorKind;
  website: string | null;
  docs: string | null;
  logo: string | null;
  endpointIds: EndpointId[];
  status: 'active' | 'retired';
}

export type ApiSurface = string;

export type EndpointPlan = 'pay-as-you-go' | 'coding-plan' | 'token-plan' | 'subscription';

export interface Endpoint {
  id: EndpointId;
  vendorId: VendorId;
  name: string;
  region: string | null;
  plan: EndpointPlan;
  baseUrl: string | null;
  sdk: string | null;
  authEnv: string[];
  upstreamIds: string[];
  status: 'active' | 'retired';
}

export type OfferingKind = 'model' | 'pointer' | 'router';

export interface OfferingVariant {
  serving: string | null;
  reasoning: 'on' | 'off' | null;
  quantization: string | null;
  free: boolean;
  region: string | null;
}

export type ResolutionMethod =
  | 'override'
  | 'base-model'
  | 'first-party'
  | 'exact-key'
  | 'learned-alias'
  | 'snapshot-date'
  | 'pointer'
  | 'structural'
  | 'router'
  | 'unresolved';

export interface Resolution {
  method: ResolutionMethod;
  upstreamCanonicalId: string | null;
  overrideId: string | null;
}

export interface Offering {
  id: OfferingId;
  vendorId: VendorId;
  endpointIds: EndpointId[];
  vendorModelId: string;
  name: string;
  kind: OfferingKind;

  modelId: ModelId | null;
  releaseId: ReleaseId | null;
  pointerId: PointerId | null;

  variant: OfferingVariant;
  status: LifecycleStatus;

  pricing: Pricing | null;
  limits: Limits;
  capabilities: Capabilities;
  modalities: Modalities;
  apis: ApiSurface[];

  resolution: Resolution;
  sources: SourceKind[];
  firstSeenAt: IsoDateTime;
  lastSeenAt: IsoDateTime;
}

export interface Pricing {
  currency: 'USD';
  text: TokenRates | null;
  image: TokenRates | null;
  audio: TokenRates | null;
  video: TokenRates | null;
  contextTiers: ContextTier[];
  units: UnitPrice[];
  webSearchPer1k: number | null;
  conditions?: {
    label: string;
    description: string;
    modality: 'text' | 'image' | 'audio' | 'video';
    rates: TokenRates;
  }[];
  validUntil?: string;
}

export interface TokenRates {
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  cacheWrite: CacheWriteRate[];
  reasoning: number | null;
}

export interface CacheWriteRate {
  ttl: string | null;
  price: number;
}

export interface ContextTier {
  minInputTokens: number;
  input: number | null;
  output: number | null;
  cacheRead: number | null;
}

export interface UnitPrice {
  modality: 'text' | 'image' | 'audio' | 'video';
  direction: 'input' | 'output';
  unit: string;
  price: number;
}

export type AgentSurface = 'cli' | 'ide' | 'ide-extension' | 'desktop' | 'web' | 'cloud';

// `default` is the vendor the agent calls out of the box, `subscription` a plan sold for the
// agent that bundles model access, and `supported` a vendor the agent can be configured to use.
export type AgentVendorRole = 'default' | 'subscription' | 'supported';

export interface AgentVendor {
  vendorId: VendorId;
  role: AgentVendorRole;
}

export interface Agent {
  id: AgentId;
  name: string;
  makerId: OrganizationId;
  description: string | null;
  website: string | null;
  docs: string | null;
  repository: string | null;
  openSource: boolean;
  license: string | null;
  surfaces: AgentSurface[];
  aliases: string[];
  vendors: AgentVendor[];
  derivedFrom: AgentId | null;
  status: 'active' | 'retired';
}

export type NamespaceKind = 'vendor' | 'sdk' | 'catalog' | 'display' | 'metorial';

export type NameOrigin = 'observed' | 'override';

export interface Name {
  id: NameId;
  namespace: string;
  raw: string;
  key: string;
  parsed: ParsedName;

  target: NameTarget;
  history: TargetPeriod[];

  origin: NameOrigin;
  sources: SourceKind[];
  status: 'live' | 'gone';
  firstSeenAt: IsoDateTime;
  lastSeenAt: IsoDateTime;
}

export type DatePrecision = 'day' | 'month' | 'month-day';

export interface ParsedName {
  labHint: OrganizationId | null;
  stem: string;
  slug: string;
  date: string | null;
  datePrecision: DatePrecision | null;
  isLatest: boolean;
  region: string | null;
  revision: string | null;
  variant: OfferingVariant;
  wrapper: string | null;
}
