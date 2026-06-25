import type { AssistantModelWithProvider } from '../services/assistant';
import { modelPresenter } from './model';

export let assistantModelPresenter = (model: AssistantModelWithProvider | null) =>
  model ? modelPresenter(model) : null;
