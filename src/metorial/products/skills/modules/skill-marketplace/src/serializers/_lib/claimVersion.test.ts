import { describe, expect, it } from 'vitest';
import { claimVersion, type VersionState } from './claimVersion';

let createStore = (initial: VersionState) => {
  let state = { ...initial };
  let casCalls = 0;

  return {
    get state() {
      return state;
    },
    get casCalls() {
      return casCalls;
    },
    compareAndSet: async (d: {
      expectedVersionHash: string | null;
      versionHash: string;
      version: string;
    }) => {
      casCalls++;
      if (state.versionHash !== d.expectedVersionHash) return false;
      state = { version: d.version, versionHash: d.versionHash };
      return true;
    },
    reload: async () => ({ ...state }),
    overwrite: (next: VersionState) => {
      state = next;
    }
  };
};

describe('claimVersion', () => {
  it('bumps the patch version when the hash changed', async () => {
    let store = createStore({ version: '1.2.3', versionHash: 'a' });

    let result = await claimVersion({
      initial: { ...store.state },
      hash: 'b',
      compareAndSet: store.compareAndSet,
      reload: store.reload
    });

    expect(result).toEqual({ version: '1.2.4', versionHash: 'b' });
    expect(store.state).toEqual(result);
  });

  it('starts from 0.0.1 when no version exists yet', async () => {
    let store = createStore({ version: null, versionHash: null });

    let result = await claimVersion({
      initial: { ...store.state },
      hash: 'a',
      compareAndSet: store.compareAndSet,
      reload: store.reload
    });

    expect(result).toEqual({ version: '0.0.1', versionHash: 'a' });
  });

  it('does not write when the hash is already current', async () => {
    let store = createStore({ version: '1.0.0', versionHash: 'a' });

    let result = await claimVersion({
      initial: { ...store.state },
      hash: 'a',
      compareAndSet: store.compareAndSet,
      reload: store.reload
    });

    expect(result).toEqual({ version: '1.0.0', versionHash: 'a' });
    expect(store.casCalls).toBe(0);
  });

  it('adopts the concurrent version when a racing sync wrote the same hash', async () => {
    let store = createStore({ version: '1.0.0', versionHash: 'a' });
    store.overwrite({ version: '1.0.1', versionHash: 'b' });

    let result = await claimVersion({
      initial: { version: '1.0.0', versionHash: 'a' },
      hash: 'b',
      compareAndSet: store.compareAndSet,
      reload: store.reload
    });

    expect(result).toEqual({ version: '1.0.1', versionHash: 'b' });
  });

  it('fails instead of overwriting a concurrent write with a different hash', async () => {
    let store = createStore({ version: '1.0.0', versionHash: 'a' });
    store.overwrite({ version: '1.0.1', versionHash: 'c' });

    await expect(
      claimVersion({
        initial: { version: '1.0.0', versionHash: 'a' },
        hash: 'b',
        compareAndSet: store.compareAndSet,
        reload: store.reload
      })
    ).rejects.toThrow('Version changed while its sync was being processed');

    expect(store.state).toEqual({ version: '1.0.1', versionHash: 'c' });
    expect(store.casCalls).toBe(1);
  });
});
