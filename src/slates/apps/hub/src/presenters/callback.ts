import type { Callback, Slate } from '../../prisma/generated/client';

export let callbackPresenter = (callback: Callback & { slate: Slate }) => ({
  object: 'callback',

  id: callback.id,
  status: callback.status,

  slateId: callback.slate.id,

  name: callback.name,
  description: callback.description,

  createdAt: callback.createdAt,
  updatedAt: callback.updatedAt
});
