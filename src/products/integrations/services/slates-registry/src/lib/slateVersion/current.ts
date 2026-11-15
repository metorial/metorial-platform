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

type ActivationLike<T> = {
  mode: 'latest' | 'pinned';
  pinnedVersion: T | null;
} | null;

let prebuiltBackends = new Set(['local_built', 'npm']);

// A pinned activation (mirror registries only) overrides the semver-highest version.
export let getEffectiveCurrentSlateVersion = <T extends VersionLike & { backend: string }>(d: {
  supportsBuilt: boolean;
  unbuiltCurrentVersion: T | null;
  builtOrUnbuiltCurrentVersion: T | null;
  activation?: ActivationLike<T>;
}) => {
  let pinned = d.activation?.mode === 'pinned' ? d.activation.pinnedVersion : null;
  if (pinned && (d.supportsBuilt || !prebuiltBackends.has(pinned.backend))) return pinned;

  return getPreferredCurrentSlateVersion(d);
};
