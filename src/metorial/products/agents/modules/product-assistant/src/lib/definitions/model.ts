import { db, ID, type ProductAssistantModel as PersistedModel } from '@metorial/db';
import type { LanguageModel } from 'ai';
import { getModelInfo } from './models';
import type { Provider } from './provider';

export interface Model {
  _persisted: PersistedModel;
  model: LanguageModel;
  provider: Provider;
  slug: string;
  name: string;
  contextWindow: number;
  inputCostPerMillionTokens: number;
  outputCostPerMillionTokens: number;
}

export let model = async (d: {
  slug: string;
  name: string;
  model: LanguageModel;
  provider: Promise<Provider>;
}) => {
  let provider = await d.provider;
  let info = await getModelInfo(provider.slug, d.slug);

  let inner = {
    slug: d.slug,
    name: d.name,
    contextWindow: info?.limit?.context ?? 50_000,
    inputCostPerMillionTokens: info?.cost?.input ?? 0,
    outputCostPerMillionTokens: info?.cost?.output ?? 0
  };

  let _persisted = await db.productAssistantModel.upsert({
    where: {
      slug_providerOid: { slug: d.slug, providerOid: provider._persisted.oid }
    },
    update: inner,
    create: {
      id: await ID.generateId('productAssistantModel'),
      providerOid: provider._persisted.oid,
      ...inner
    }
  });

  return {
    _persisted,
    info,
    model: d.model,
    provider,
    ...inner
  };
};
