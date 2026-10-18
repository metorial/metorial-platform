import semver from 'semver';

export interface VersionState {
  version: string | null;
  versionHash: string | null;
}

let maxClaimAttempts = 5;

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
  let state = d.initial;

  for (let attempt = 0; attempt < maxClaimAttempts; attempt++) {
    if (state.versionHash === d.hash) return state;

    let version = semver.inc(state.version ?? '0.0.0', 'patch')!;

    let claimed = await d.compareAndSet({
      expectedVersionHash: state.versionHash,
      versionHash: d.hash,
      version
    });
    if (claimed) return { version, versionHash: d.hash };

    state = await d.reload();
  }

  throw new Error(
    `Could not claim a version for hash ${d.hash} after ${maxClaimAttempts} attempts`
  );
};
