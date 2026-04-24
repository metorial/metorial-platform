import semver from 'semver';

type VersionLike = {
  id: string;
  version: string;
  createdAt: Date;
};

export let getPreferredCurrentSlateVersion = <T extends VersionLike>(d: {
  supportsBuilt: boolean;
  unbuiltCurrentVersion: T | null;
  builtOrUnbuiltCurrentVersion: T | null;
}) => {
  if (!d.supportsBuilt) return d.unbuiltCurrentVersion;

  if (!d.unbuiltCurrentVersion) return d.builtOrUnbuiltCurrentVersion;
  if (!d.builtOrUnbuiltCurrentVersion) return d.unbuiltCurrentVersion;

  return semver.gte(d.builtOrUnbuiltCurrentVersion.version, d.unbuiltCurrentVersion.version)
    ? d.builtOrUnbuiltCurrentVersion
    : d.unbuiltCurrentVersion;
};
