export type VersionData = {
  id: string;
  version: string;
  isCurrent: boolean;
  name: string;
  description: string | null;
  releasedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export let versionPresenter = (version: VersionData) => ({
  object: 'provider.version' as const,
  id: version.id,
  version: version.version,
  isCurrent: version.isCurrent,
  name: version.name,
  description: version.description,
  releasedAt: version.releasedAt,
  createdAt: version.createdAt,
  updatedAt: version.updatedAt
});
