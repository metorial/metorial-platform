import { AssistantModelProvider, db, getImageUrl, ID } from '@metorial/db';

export type ProviderSlug =
  | 'cohere'
  | 'meta'
  | 'moonshotai-cn'
  | 'lucidquery'
  | 'moonshotai'
  | 'zai-coding-plan'
  | 'alibaba'
  | 'xai'
  | 'vultr'
  | 'nvidia'
  | 'upstage'
  | 'groq'
  | 'github-copilot'
  | 'mistral'
  | 'vercel'
  | 'nebius'
  | 'deepseek'
  | 'alibaba-cn'
  | 'google-vertex-anthropic'
  | 'venice'
  | 'chutes'
  | 'cortecs'
  | 'github-models'
  | 'togetherai'
  | 'azure'
  | 'baseten'
  | 'huggingface'
  | 'opencode'
  | 'fastrouter'
  | 'google'
  | 'google-vertex'
  | 'cloudflare-workers-ai'
  | 'inception'
  | 'wandb'
  | 'openai'
  | 'zhipuai-coding-plan'
  | 'perplexity'
  | 'openrouter'
  | 'zenmux'
  | 'v0'
  | 'iflowcn'
  | 'synthetic'
  | 'deepinfra'
  | 'zhipuai'
  | 'submodel'
  | 'zai'
  | 'inference'
  | 'requesty'
  | 'morph'
  | 'lmstudio'
  | 'anthropic'
  | 'aihubmix'
  | 'fireworks-ai'
  | 'modelscope'
  | 'llama'
  | 'scaleway'
  | 'amazon-bedrock'
  | 'cerebras';

export interface Provider {
  _persisted: AssistantModelProvider;
  slug: ProviderSlug;
  name: string;
  imageUrl: string;
}

export let provider = async (d: { slug: ProviderSlug; name: string }): Promise<Provider> => {
  let imageUrl = await getImageUrl({
    id: `provider_${d.slug}`,
    name: d.name,
    image: { url: `https://models.dev/logos/${d.slug}.svg`, type: 'url' }
  });

  let _persisted = await db.assistantModelProvider.upsert({
    where: { slug: d.slug },
    update: { name: d.name, imageUrl },
    create: {
      id: await ID.generateId('assistantModelProvider'),
      slug: d.slug,
      name: d.name,
      imageUrl
    }
  });

  return {
    _persisted,
    slug: d.slug,
    name: d.name,
    imageUrl
  };
};
