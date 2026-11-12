import { describe, expect, it } from 'bun:test';
import { getEffectiveCurrentSlateVersion } from './current';

let version = (id: string, semver: string, backend = 'local_unbuilt') => ({
  id,
  version: semver,
  backend,
  createdAt: new Date()
});

describe('effective current slate version', () => {
  let unbuilt = version('v2', '2.0.0');
  let built = version('v3', '3.0.0', 'local_built');
  let pinned = version('v1', '1.0.0');

  it('follows the latest version without a pin', () => {
    expect(
      getEffectiveCurrentSlateVersion({
        supportsBuilt: true,
        unbuiltCurrentVersion: unbuilt,
        builtOrUnbuiltCurrentVersion: built,
        activation: { mode: 'latest', pinnedVersion: null }
      })
    ).toBe(built);
  });

  it('prefers a pinned version, even an older one', () => {
    expect(
      getEffectiveCurrentSlateVersion({
        supportsBuilt: true,
        unbuiltCurrentVersion: unbuilt,
        builtOrUnbuiltCurrentVersion: built,
        activation: { mode: 'pinned', pinnedVersion: pinned }
      })
    ).toBe(pinned);
  });

  it('ignores a prebuilt pin for consumers without prebuilt support', () => {
    expect(
      getEffectiveCurrentSlateVersion({
        supportsBuilt: false,
        unbuiltCurrentVersion: unbuilt,
        builtOrUnbuiltCurrentVersion: built,
        activation: { mode: 'pinned', pinnedVersion: built }
      })
    ).toBe(unbuilt);
  });
});
