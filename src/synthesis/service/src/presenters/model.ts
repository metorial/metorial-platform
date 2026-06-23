import type { Model, ModelProvider } from '../db';
import { modelProviderPresenter } from './modelProvider';

export let modelPresenter = (model: Model & { provider: ModelProvider }) => ({
  object: 'synthesis#model',
  id: model.id,
  name: model.name,
  slug: model.slug,
  contextWindow: model.contextWindow,
  inputCostPerMillionTokens: model.inputCostPerMillionTokens,
  outputCostPerMillionTokens: model.outputCostPerMillionTokens,
  provider: modelProviderPresenter(model.provider),
  createdAt: model.createdAt,
  updatedAt: model.updatedAt
});
