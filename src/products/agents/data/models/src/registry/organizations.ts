export interface OrganizationSeed {
  id: string;
  name: string;
  aliases?: string[];
  country?: string;
  website?: string;
}

// Aliases cover models.dev lab ids, provider ids, Hugging Face namespaces, Bedrock namespaces and
// gateway prefixes. Anything that names the *maker* of a model belongs here; vendor-only prefixes
// (azure/, vertex/, bedrock/) don't, because they say nothing about who made the model.
export let organizationSeeds: OrganizationSeed[] = [
  { id: 'anthropic', name: 'Anthropic', country: 'US', website: 'https://www.anthropic.com' },
  { id: 'openai', name: 'OpenAI', country: 'US', website: 'https://openai.com' },
  {
    id: 'google',
    name: 'Google',
    aliases: ['google-ai-studio', 'google-deepmind', 'gemini', 'gemma', 'google-ai'],
    country: 'US',
    website: 'https://ai.google.dev'
  },
  {
    id: 'meta',
    name: 'Meta',
    aliases: ['meta-llama', 'facebook', 'llama', 'meta-contributor'],
    country: 'US',
    website: 'https://ai.meta.com'
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    aliases: ['mistralai', 'mistral-ai'],
    country: 'FR',
    website: 'https://mistral.ai'
  },
  {
    id: 'alibaba',
    name: 'Alibaba',
    aliases: ['qwen', 'alibaba-cloud', 'alibaba-qwen', 'qwen-ai', 'wanx', 'wan-ai', 'tongyi'],
    country: 'CN',
    website: 'https://qwen.ai'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    aliases: ['deepseek-ai'],
    country: 'CN',
    website: 'https://www.deepseek.com'
  },
  {
    id: 'moonshot',
    name: 'Moonshot AI',
    aliases: ['moonshotai', 'moonshot-ai', 'kimi'],
    country: 'CN',
    website: 'https://www.moonshot.ai'
  },
  {
    id: 'zhipu',
    name: 'Zhipu AI',
    aliases: ['zhipuai', 'zhipu-ai', 'zai', 'z-ai', 'zai-org', 'thudm', 'glm'],
    country: 'CN',
    website: 'https://z.ai'
  },
  {
    id: 'xai',
    name: 'xAI',
    aliases: ['x-ai', 'grok'],
    country: 'US',
    website: 'https://x.ai'
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    aliases: ['minimaxai', 'minimax-ai'],
    country: 'CN',
    website: 'https://www.minimax.io'
  },
  {
    id: 'xiaomi',
    name: 'Xiaomi',
    aliases: ['xiaomimimo', 'mimo'],
    country: 'CN',
    website: 'https://mimo.xiaomi.com'
  },
  {
    id: 'bytedance',
    name: 'ByteDance',
    aliases: ['bytedance-seed', 'bytedance-research', 'doubao'],
    country: 'CN',
    website: 'https://seed.bytedance.com'
  },
  {
    id: 'nvidia',
    name: 'NVIDIA',
    aliases: ['nvidia-ai'],
    country: 'US',
    website: 'https://build.nvidia.com'
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    aliases: ['microsoft-ai', 'phi'],
    country: 'US',
    website: 'https://ai.azure.com'
  },
  {
    id: 'amazon',
    name: 'Amazon',
    aliases: ['amazon-nova', 'aws'],
    country: 'US',
    website: 'https://aws.amazon.com/ai'
  },
  {
    id: 'cohere',
    name: 'Cohere',
    aliases: ['cohereforai', 'coherelabs', 'cohere-labs'],
    country: 'CA',
    website: 'https://cohere.com'
  },
  {
    id: 'ai21',
    name: 'AI21 Labs',
    aliases: ['ai21labs'],
    country: 'IL',
    website: 'https://www.ai21.com'
  },
  {
    id: 'ibm',
    name: 'IBM',
    aliases: ['ibm-granite', 'granite'],
    country: 'US',
    website: 'https://www.ibm.com/granite'
  },
  {
    id: 'tencent',
    name: 'Tencent',
    aliases: ['tencent-hunyuan', 'hunyuan'],
    country: 'CN',
    website: 'https://hunyuan.tencent.com'
  },
  {
    id: 'baidu',
    name: 'Baidu',
    aliases: ['ernie', 'paddlepaddle'],
    country: 'CN',
    website: 'https://yiyan.baidu.com'
  },
  {
    id: 'stepfun',
    name: 'StepFun',
    aliases: ['stepfun-ai'],
    country: 'CN',
    website: 'https://www.stepfun.com'
  },
  {
    id: 'meituan',
    name: 'Meituan',
    aliases: ['longcat', 'meituan-longcat'],
    country: 'CN',
    website: 'https://longcat.ai'
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    aliases: ['perplexity-ai'],
    country: 'US',
    website: 'https://www.perplexity.ai'
  },
  {
    id: 'inception',
    name: 'Inception',
    aliases: ['inceptionlabs'],
    country: 'US',
    website: 'https://www.inceptionlabs.ai'
  },
  { id: 'poolside', name: 'Poolside', country: 'US', website: 'https://poolside.ai' },
  {
    id: 'sakana',
    name: 'Sakana AI',
    aliases: ['sakanaai'],
    country: 'JP',
    website: 'https://sakana.ai'
  },
  {
    id: 'sarvam',
    name: 'Sarvam AI',
    aliases: ['sarvamai'],
    country: 'IN',
    website: 'https://www.sarvam.ai'
  },
  { id: 'upstage', name: 'Upstage', country: 'KR', website: 'https://www.upstage.ai' },
  { id: 'reflection', name: 'Reflection AI', aliases: ['reflection-ai'], country: 'US' },
  {
    id: 'liquid',
    name: 'Liquid AI',
    aliases: ['liquidai', 'lfm'],
    country: 'US',
    website: 'https://www.liquid.ai'
  },
  { id: 'nousresearch', name: 'Nous Research', aliases: ['nous'], country: 'US' },
  { id: 'black-forest-labs', name: 'Black Forest Labs', aliases: ['bfl'], country: 'DE' },
  {
    id: 'stability',
    name: 'Stability AI',
    aliases: ['stabilityai', 'stability-ai'],
    country: 'GB'
  },
  {
    id: 'inclusionai',
    name: 'inclusionAI',
    aliases: ['inclusion-ai', 'ant-ling'],
    country: 'CN'
  },
  { id: 'arcee', name: 'Arcee AI', aliases: ['arcee-ai'], country: 'US' },
  {
    id: 'thinkingmachines',
    name: 'Thinking Machines Lab',
    aliases: ['thinking-machines'],
    country: 'US'
  },
  { id: 'writer', name: 'Writer', aliases: ['palmyra'], country: 'US' },
  { id: 'voyage', name: 'Voyage AI', aliases: ['voyageai', 'voyage-ai'], country: 'US' },
  {
    id: 'kuaishou',
    name: 'Kuaishou',
    aliases: ['kling', 'klingai', 'kling-ai'],
    country: 'CN'
  },
  { id: 'runway', name: 'Runway', aliases: ['runwayml'], country: 'US' },
  { id: 'reka', name: 'Reka', aliases: ['rekaai', 'reka-ai'], country: 'US' },
  { id: 'mixedbread', name: 'Mixedbread', aliases: ['mixedbread-ai'], country: 'DE' },
  { id: 'fireworks', name: 'Fireworks AI', aliases: ['fireworks-ai'], country: 'US' },
  { id: 'cloudflare', name: 'Cloudflare', country: 'US' },
  { id: 'vercel', name: 'Vercel', country: 'US' },
  { id: 'github', name: 'GitHub', country: 'US' },
  { id: 'openrouter', name: 'OpenRouter', country: 'US', website: 'https://openrouter.ai' },
  {
    id: 'together',
    name: 'Together AI',
    aliases: ['togetherai', 'togethercomputer'],
    country: 'US'
  },
  { id: 'huggingface', name: 'Hugging Face', aliases: ['hf'], country: 'US' },
  { id: 'deepinfra', name: 'Deep Infra', country: 'US' },
  { id: 'groq', name: 'Groq', country: 'US' },
  { id: 'cerebras', name: 'Cerebras', country: 'US' },
  { id: 'sambanova', name: 'SambaNova', country: 'US' },
  { id: 'oracle', name: 'Oracle', aliases: ['oci'], country: 'US' },
  { id: 'sap', name: 'SAP', country: 'DE' },
  { id: 'snowflake', name: 'Snowflake', country: 'US' },
  { id: 'databricks', name: 'Databricks', country: 'US' },
  {
    id: 'baai',
    name: 'BAAI',
    aliases: ['beijing-academy-of-artificial-intelligence'],
    country: 'CN'
  },
  { id: 'openbmb', name: 'OpenBMB', country: 'CN' },
  { id: 'nomic', name: 'Nomic AI', aliases: ['nomic-ai'], country: 'US' },
  { id: 'elevenlabs', name: 'ElevenLabs', country: 'US' },
  { id: 'deepgram', name: 'Deepgram', country: 'US' },
  { id: 'cognitivecomputations', name: 'Cognitive Computations', country: 'US' }
];
