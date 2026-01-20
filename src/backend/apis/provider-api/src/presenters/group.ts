export type GroupData = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export let groupPresenter = (group: GroupData) => ({
  object: 'provider.group' as const,
  id: group.id,
  name: group.name,
  description: group.description,
  slug: group.slug,
  createdAt: group.createdAt,
  updatedAt: group.updatedAt
});
