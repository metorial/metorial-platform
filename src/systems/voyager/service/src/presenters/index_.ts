import type { Index, Source } from '../../prisma/generated/client';
import { sourcePresenter } from './source';

export let indexPresenter = (index: Index & { source: Source }) => ({
  object: 'voyager#index',

  id: index.id,
  identifier: index.identifier,
  name: index.name,

  source: sourcePresenter(index.source),

  createdAt: index.createdAt
});
