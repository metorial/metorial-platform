import { Instance } from '@metorial/db';

export let instancePresenter = async (instance: Instance) => ({
  object: 'portal#instance',

  id: instance.id,

  name: instance.name,
  slug: instance.slug,

  type: instance.type,

  createdAt: instance.createdAt,
  updatedAt: instance.updatedAt
});
