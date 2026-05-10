import type { AssistantInstance } from '../db';

export let assistantInstancePresenter = (instance: AssistantInstance) => ({
  object: 'synthesis#assistantInstance',
  id: instance.id,
  createdAt: instance.createdAt,
  updatedAt: instance.updatedAt
});
