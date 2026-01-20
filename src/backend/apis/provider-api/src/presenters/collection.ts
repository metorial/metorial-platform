export type CollectionData = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let collectionPresenter = (collection: CollectionData) => ({
  object: 'provider.collection' as const,
  id: collection.id,
  name: collection.name,
  description: collection.description,
  slug: collection.slug,
  createdAt: collection.createdAt,
  updatedAt: collection.updatedAt
});
