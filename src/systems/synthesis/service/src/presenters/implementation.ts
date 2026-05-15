import type { AssistantImplementation } from '../db';

export let implementationPresenter = (implementation: AssistantImplementation) => ({
  object: 'synthesis#assistantImplementation',
  id: implementation.id,
  name: implementation.name,
  slug: implementation.slug,
  createdAt: implementation.createdAt,
  updatedAt: implementation.updatedAt
});
