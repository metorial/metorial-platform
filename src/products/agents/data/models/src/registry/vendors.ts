import type { EndpointPlan, VendorKind } from '../types';

export interface VendorSeed {
  id: string;
  name: string;
  organizationId?: string;
  kind: VendorKind;
  upstream: Record<string, EndpointSeed>;
}

export interface EndpointSeed {
  slug: string;
  region?: string;
  plan?: EndpointPlan;
}

let single = (upstream: string, slug = 'default'): Record<string, EndpointSeed> => ({
  [upstream]: { slug }
});

// Groups models.dev providers into one vendor per account you'd actually open, with region/plan
// variants as endpoints. Providers not listed here become their own vendor (see deriveVendor).
export let vendorSeeds: VendorSeed[] = [
  { id: 'anthropic', name: 'Anthropic', kind: 'first-party', upstream: single('anthropic') },
  { id: 'openai', name: 'OpenAI', kind: 'first-party', upstream: single('openai') },
  {
    id: 'google-ai-studio',
    name: 'Google AI Studio',
    organizationId: 'google',
    kind: 'first-party',
    upstream: single('google')
  },
  {
    id: 'google-vertex',
    name: 'Google Vertex AI',
    organizationId: 'google',
    kind: 'cloud',
    upstream: {
      'google-vertex': { slug: 'default' },
      'google-vertex-anthropic': { slug: 'anthropic' }
    }
  },
  {
    id: 'aws-bedrock',
    name: 'Amazon Bedrock',
    organizationId: 'amazon',
    kind: 'cloud',
    upstream: single('amazon-bedrock')
  },
  {
    id: 'azure',
    name: 'Microsoft Azure AI Foundry',
    organizationId: 'microsoft',
    kind: 'cloud',
    upstream: {
      azure: { slug: 'default' },
      'azure-cognitive-services': { slug: 'cognitive-services' }
    }
  },
  { id: 'mistral', name: 'Mistral AI', kind: 'first-party', upstream: single('mistral') },
  { id: 'xai', name: 'xAI', kind: 'first-party', upstream: single('xai') },
  { id: 'deepseek', name: 'DeepSeek', kind: 'first-party', upstream: single('deepseek') },
  { id: 'cohere', name: 'Cohere', kind: 'first-party', upstream: single('cohere') },
  { id: 'ai21', name: 'AI21 Labs', kind: 'first-party', upstream: single('ai21') },
  { id: 'meta', name: 'Meta Llama API', kind: 'first-party', upstream: single('meta') },
  { id: 'upstage', name: 'Upstage', kind: 'first-party', upstream: single('upstage') },
  { id: 'sakana', name: 'Sakana AI', kind: 'first-party', upstream: single('sakana') },
  { id: 'sarvam', name: 'Sarvam AI', kind: 'first-party', upstream: single('sarvam') },
  { id: 'poolside', name: 'Poolside', kind: 'first-party', upstream: single('poolside') },
  {
    id: 'reflection',
    name: 'Reflection AI',
    kind: 'first-party',
    upstream: single('reflection')
  },
  { id: 'inception', name: 'Inception', kind: 'first-party', upstream: single('inception') },
  { id: 'liquid', name: 'Liquid AI', kind: 'first-party', upstream: single('liquid') },
  {
    id: 'morph',
    name: 'Morph',
    organizationId: 'morph',
    kind: 'first-party',
    upstream: single('morph')
  },
  {
    id: 'thinkingmachines',
    name: 'Thinking Machines Lab',
    kind: 'first-party',
    upstream: single('thinkingmachines')
  },
  {
    id: 'meituan-longcat',
    name: 'LongCat',
    organizationId: 'meituan',
    kind: 'first-party',
    upstream: single('longcat')
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    kind: 'first-party',
    upstream: {
      perplexity: { slug: 'default' },
      'perplexity-agent': { slug: 'agent' }
    }
  },
  {
    id: 'alibaba-cloud',
    name: 'Alibaba Cloud Model Studio',
    organizationId: 'alibaba',
    kind: 'first-party',
    upstream: {
      alibaba: { slug: 'intl', region: 'intl' },
      'alibaba-cn': { slug: 'cn', region: 'cn' },
      'alibaba-coding-plan': { slug: 'intl-coding-plan', region: 'intl', plan: 'coding-plan' },
      'alibaba-coding-plan-cn': { slug: 'cn-coding-plan', region: 'cn', plan: 'coding-plan' },
      'alibaba-token-plan': { slug: 'intl-token-plan', region: 'intl', plan: 'token-plan' },
      'alibaba-token-plan-cn': { slug: 'cn-token-plan', region: 'cn', plan: 'token-plan' }
    }
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    kind: 'first-party',
    upstream: {
      minimax: { slug: 'intl', region: 'intl' },
      'minimax-cn': { slug: 'cn', region: 'cn' },
      'minimax-coding-plan': { slug: 'intl-token-plan', region: 'intl', plan: 'token-plan' },
      'minimax-cn-coding-plan': { slug: 'cn-token-plan', region: 'cn', plan: 'token-plan' }
    }
  },
  {
    id: 'moonshot',
    name: 'Moonshot AI',
    kind: 'first-party',
    upstream: {
      moonshotai: { slug: 'intl', region: 'intl' },
      'moonshotai-cn': { slug: 'cn', region: 'cn' },
      'kimi-code-plan-global': {
        slug: 'intl-coding-plan',
        region: 'intl',
        plan: 'coding-plan'
      },
      'kimi-code-plan-cn': { slug: 'cn-coding-plan', region: 'cn', plan: 'coding-plan' }
    }
  },
  {
    id: 'zhipu',
    name: 'Zhipu AI / Z.ai',
    kind: 'first-party',
    upstream: {
      zai: { slug: 'intl', region: 'intl' },
      'zai-coding-plan': { slug: 'intl-coding-plan', region: 'intl', plan: 'coding-plan' },
      zhipuai: { slug: 'cn', region: 'cn' },
      'zhipuai-coding-plan': { slug: 'cn-coding-plan', region: 'cn', plan: 'coding-plan' }
    }
  },
  {
    id: 'xiaomi',
    name: 'Xiaomi MiMo',
    kind: 'first-party',
    upstream: {
      xiaomi: { slug: 'default' },
      'xiaomi-token-plan-ams': { slug: 'eu-token-plan', region: 'eu', plan: 'token-plan' },
      'xiaomi-token-plan-cn': { slug: 'cn-token-plan', region: 'cn', plan: 'token-plan' },
      'xiaomi-token-plan-sgp': { slug: 'sg-token-plan', region: 'sg', plan: 'token-plan' }
    }
  },
  {
    id: 'stepfun',
    name: 'StepFun',
    kind: 'first-party',
    upstream: {
      'stepfun-ai': { slug: 'intl', region: 'intl' },
      stepfun: { slug: 'cn', region: 'cn' },
      'stepfun-ai-step-plan': { slug: 'intl-step-plan', region: 'intl', plan: 'subscription' },
      'stepfun-step-plan': { slug: 'cn-step-plan', region: 'cn', plan: 'subscription' }
    }
  },
  {
    id: 'tencent-cloud',
    name: 'Tencent Cloud',
    organizationId: 'tencent',
    kind: 'first-party',
    upstream: {
      'tencent-tokenhub': { slug: 'tokenhub' },
      'tencent-token-plan': { slug: 'token-plan', plan: 'token-plan' },
      'tencent-coding-plan': { slug: 'cn-coding-plan', region: 'cn', plan: 'coding-plan' }
    }
  },
  {
    id: 'volcengine',
    name: 'Volcengine Ark',
    organizationId: 'bytedance',
    kind: 'cloud',
    upstream: {
      volcengine: { slug: 'default' },
      'volcengine-coding-plan': { slug: 'coding-plan', plan: 'coding-plan' }
    }
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    kind: 'inference',
    upstream: {
      siliconflow: { slug: 'intl', region: 'intl' },
      'siliconflow-cn': { slug: 'cn', region: 'cn' }
    }
  },
  {
    id: 'munito',
    name: 'Munito AI',
    kind: 'aggregator',
    upstream: {
      munito: { slug: 'default' },
      'munito-eu': { slug: 'eu', region: 'eu' }
    }
  },
  {
    id: 'llmgateway',
    name: 'LLM Gateway',
    kind: 'aggregator',
    upstream: {
      'llmgateway-providers': { slug: 'default' },
      llmgateway: { slug: 'devpass', plan: 'subscription' }
    }
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    kind: 'subscription',
    upstream: {
      opencode: { slug: 'zen' },
      'opencode-go': { slug: 'go', plan: 'subscription' }
    }
  },
  {
    id: 'umans-ai',
    name: 'Umans AI',
    kind: 'aggregator',
    upstream: {
      'umans-ai': { slug: 'default' },
      'umans-ai-coding-plan': { slug: 'coding-plan', plan: 'coding-plan' }
    }
  },
  {
    id: 'cloudflare-workers-ai',
    name: 'Cloudflare Workers AI',
    organizationId: 'cloudflare',
    kind: 'inference',
    upstream: single('cloudflare-workers-ai')
  },
  {
    id: 'cloudflare-ai-gateway',
    name: 'Cloudflare AI Gateway',
    organizationId: 'cloudflare',
    kind: 'aggregator',
    upstream: single('cloudflare-ai-gateway')
  },
  {
    id: 'vercel-ai-gateway',
    name: 'Vercel AI Gateway',
    organizationId: 'vercel',
    kind: 'aggregator',
    upstream: single('vercel')
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    organizationId: 'github',
    kind: 'subscription',
    upstream: single('github-copilot')
  },
  {
    id: 'fireworks',
    name: 'Fireworks AI',
    organizationId: 'fireworks',
    kind: 'inference',
    upstream: single('fireworks-ai')
  },
  {
    id: 'together',
    name: 'Together AI',
    organizationId: 'together',
    kind: 'inference',
    upstream: single('togetherai')
  },
  {
    id: 'oracle-oci',
    name: 'OCI Generative AI',
    organizationId: 'oracle',
    kind: 'cloud',
    upstream: single('oci')
  },
  {
    id: 'sap-ai-core',
    name: 'SAP AI Core',
    organizationId: 'sap',
    kind: 'cloud',
    upstream: single('sap-ai-core')
  },
  {
    id: 'snowflake-cortex',
    name: 'Snowflake Cortex',
    organizationId: 'snowflake',
    kind: 'cloud',
    upstream: single('snowflake-cortex')
  },
  {
    id: 'ibm-watsonx',
    name: 'IBM watsonx.ai',
    organizationId: 'ibm',
    kind: 'cloud',
    upstream: single('watsonx')
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    organizationId: 'nvidia',
    kind: 'inference',
    upstream: single('nvidia')
  }
];

export let vendorKindHints: Record<string, VendorKind> = {
  openrouter: 'aggregator',
  kilo: 'aggregator',
  requesty: 'aggregator',
  helicone: 'aggregator',
  poe: 'aggregator',
  'nano-gpt': 'aggregator',
  edenai: 'aggregator',
  fastrouter: 'aggregator',
  aihubmix: 'aggregator',
  '302ai': 'aggregator',
  zenmux: 'aggregator',
  aimlapi: 'aggregator',
  orcarouter: 'aggregator',
  trustedrouter: 'aggregator',
  lowrouter: 'aggregator',
  'ai-router': 'aggregator',
  agentrouter: 'aggregator',
  unorouter: 'aggregator',
  tokenrouter: 'aggregator',
  'routing-run': 'aggregator',
  'merge-gateway': 'aggregator',
  anyapi: 'aggregator',
  bothub: 'aggregator',
  huggingface: 'aggregator',
  'salad-cloud': 'aggregator',
  tempr: 'aggregator',
  'cline-pass': 'subscription',
  gitlab: 'subscription',
  'kuae-cloud-coding-plan': 'subscription',
  'scnet-token-plan': 'subscription',
  databricks: 'cloud',
  scaleway: 'cloud',
  ovhcloud: 'cloud',
  stackit: 'cloud',
  vultr: 'cloud',
  hetzner: 'cloud',
  digitalocean: 'cloud',
  nebius: 'cloud',
  wandb: 'cloud',
  crusoe: 'cloud',
  infomaniak: 'cloud',
  evroc: 'cloud',
  'cloudferro-sherlock': 'cloud'
};
