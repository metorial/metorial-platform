import type { SlateCategory } from '../../prisma/generated/client';

export let slateCategoryPresenter = (category: SlateCategory) => ({
  object: 'slate.category',

  id: category.id,
  identifier: category.identifier,
  name: category.name,
  createdAt: category.createdAt
});
