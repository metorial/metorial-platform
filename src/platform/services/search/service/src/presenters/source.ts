import type { Source } from '../../prisma/generated/client';

export let sourcePresenter = (source: Source) => ({
  object: 'voyager#source',

  id: source.id,
  identifier: source.identifier,
  name: source.name,

  createdAt: source.createdAt
});
