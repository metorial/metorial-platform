import semver from 'semver';

export interface VersionState {
  version: string | null;
  versionHash: string | null;
}

export let claimVersion = async (d: {
  initial: VersionState;
  hash: string;
  compareAndSet: (d: {
    expectedVersionHash: string | null;
    versionHash: string;
    version: string;
  }) => Promise<boolean>;
  reload: () => Promise<VersionState>;
}): Promise<VersionState> => {
  if (d.initial.versionHash === d.hash) return d.initial;

  let version = semver.inc(d.initial.version ?? '0.0.0', 'patch')!;

  let claimed = await d.compareAndSet({
    expectedVersionHash: d.initial.versionHash,
    versionHash: d.hash,
    version
  });
  if (claimed) return { version, versionHash: d.hash };

  let current = await d.reload();
  if (current.versionHash === d.hash) return current;

  // A different hash means another sync published since our snapshot was loaded. We can't tell
  // which snapshot is newer, so publishing ours could overwrite newer content.
  throw new Error('Version changed while its sync was being processed');
};
