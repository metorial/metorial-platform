export type PublisherData = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  image: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export let publisherPresenter = (publisher: PublisherData) => ({
  object: 'publisher' as const,
  id: publisher.id,
  name: publisher.name,
  description: publisher.description,
  slug: publisher.slug,
  image: publisher.image,
  createdAt: publisher.createdAt,
  updatedAt: publisher.updatedAt
});
