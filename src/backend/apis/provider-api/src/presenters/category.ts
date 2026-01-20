export type CategoryData = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let categoryPresenter = (category: CategoryData) => ({
  object: 'provider.category' as const,
  id: category.id,
  name: category.name,
  description: category.description,
  slug: category.slug,
  createdAt: category.createdAt,
  updatedAt: category.updatedAt
});
