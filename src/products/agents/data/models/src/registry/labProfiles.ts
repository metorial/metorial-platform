import type { VariantSuffixRule } from '../normalize/parseName';

export interface LabProfile {
  labId: string;
  dateSemantics: 'snapshot' | 'version';
  dashedVersions: boolean;
  tiers: string[];
  letterSeries: boolean;
  versionLetterTiers: string[];
  namePrefixes: string[];
  variantSuffixes: VariantSuffixRule[];
  casing: Record<string, string>;
  familyNames: Record<string, string>;
}

export let globalTiers = [
  'pro',
  'flash',
  'lite',
  'mini',
  'nano',
  'max',
  'plus',
  'turbo',
  'large',
  'medium',
  'small',
  'tiny',
  'ultra',
  'air',
  'flashx',
  'codex',
  'coder',
  'code',
  'vl',
  'omni',
  'image',
  'embedding',
  'embed',
  'tts',
  'realtime',
  'audio',
  'search',
  'reasoning',
  'thinking',
  'deep-research',
  'nemo',
  'edge',
  'spark',
  'premier',
  'micro',
  'vision',
  'guard',
  'math',
  'rerank',
  'reranker',
  'ocr',
  'transcribe',
  'moderation'
];

// Modifiers describe one checkpoint of a model without moving it to another series.
export let globalModifiers = [
  'instruct',
  'it',
  'chat',
  'preview',
  'exp',
  'experimental',
  'base',
  'hf',
  'beta',
  'alpha',
  'customtools',
  'latest'
];

export let globalCasing: Record<string, string> = {
  gpt: 'GPT',
  glm: 'GLM',
  ai: 'AI',
  tts: 'TTS',
  vl: 'VL',
  ocr: 'OCR',
  oss: 'OSS',
  llm: 'LLM',
  lfm: 'LFM',
  qwq: 'QwQ',
  qvq: 'QVQ',
  deepseek: 'DeepSeek',
  minimax: 'MiniMax',
  mimo: 'MiMo',
  ernie: 'ERNIE',
  sdxl: 'SDXL',
  flux: 'FLUX',
  hd: 'HD',
  api: 'API',
  asr: 'ASR',
  mt: 'MT',
  r: 'R',
  v: 'V',
  k: 'K',
  m: 'M',
  flashx: 'FlashX',
  codestral: 'Codestral',
  longcat: 'LongCat',
  seedream: 'Seedream',
  ui: 'UI',
  it: 'IT',
  e5: 'E5',
  bge: 'BGE',
  mai: 'MAI',
  c4ai: 'C4AI',
  gte: 'GTE',
  tdt: 'TDT'
};

let reasoningSuffixes: VariantSuffixRule[] = [
  { suffix: '-non-reasoning', variant: { reasoning: 'off' } },
  { suffix: '-reasoning', variant: { reasoning: 'on' } }
];

let defaults: Omit<LabProfile, 'labId'> = {
  dateSemantics: 'version',
  dashedVersions: false,
  tiers: [],
  letterSeries: false,
  versionLetterTiers: [],
  namePrefixes: [],
  variantSuffixes: [],
  casing: {},
  familyNames: {}
};

let profiles: Record<string, Partial<LabProfile>> = {
  anthropic: {
    dateSemantics: 'snapshot',
    dashedVersions: true,
    tiers: ['opus', 'sonnet', 'haiku', 'fable', 'mythos', 'instant']
  },
  openai: {
    dateSemantics: 'snapshot',
    tiers: [
      'sol',
      'terra',
      'luna',
      'astra',
      'cyber',
      'instant',
      'safeguard',
      'live',
      'diarize',
      'whisper',
      'chat'
    ],
    familyNames: {
      o: 'o-series',
      'o-mini': 'o-series Mini',
      'o-pro': 'o-series Pro',
      'o-deep-research': 'o-series Deep Research',
      'o-mini-deep-research': 'o-series Mini Deep Research'
    }
  },
  google: {
    tiers: ['live', 'native-audio', 'computer-use', 'robotics', 'er', 'generate', 'streaming'],
    casing: { er: 'ER' }
  },
  mistral: {
    dashedVersions: true,
    namePrefixes: ['open-', 'labs-'],
    tiers: ['saba']
  },
  alibaba: {
    tiers: ['asr', 'mt', 'long', 'next', 'livetranslate', 'captioner', 'character'],
    casing: { qwen: 'Qwen' }
  },
  deepseek: {
    letterSeries: true,
    familyNames: { 'deepseek-r': 'DeepSeek R', 'deepseek-v': 'DeepSeek V' }
  },
  moonshot: {
    casing: { kimi: 'Kimi' }
  },
  zhipu: {
    versionLetterTiers: ['v'],
    familyNames: { 'glm-v': 'GLM V' }
  },
  xai: {
    tiers: ['fast', 'imagine'],
    variantSuffixes: reasoningSuffixes
  },
  meta: {
    tiers: ['scout', 'maverick', 'behemoth']
  },
  minimax: {
    tiers: ['speech', 'hailuo']
  },
  amazon: {
    tiers: ['premier', 'sonic', 'canvas', 'reel']
  }
};

let cache = new Map<string, LabProfile>();

export let getLabProfile = (labId: string): LabProfile => {
  let cached = cache.get(labId);
  if (cached) return cached;

  let profile: LabProfile = { ...defaults, ...profiles[labId], labId };
  cache.set(labId, profile);
  return profile;
};

export let labVariantSuffixes = (labId: string) => getLabProfile(labId).variantSuffixes;
