import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { deleteResponseType } from '../types';

export let v1DeleteResponsePresenter = Presenter.create(deleteResponseType)
  .presenter(async ({ id, object }) => ({
    id,
    object,
    deleted: true as const
  }))
  .schema(
    v.object({
      id: v.string({ name: 'id', description: 'The ID of the deleted resource', examples: ['pvd_abc123def456'] }),
      object: v.string({ name: 'object', description: 'The type of the deleted resource', examples: ['provider.deployment', 'provider.config'] }),
      deleted: v.literal(true, { name: 'deleted', description: 'Always true for delete responses' })
    })
  )
  .build();
