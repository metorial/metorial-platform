import { describe, expect, it } from 'vitest';
import { selectCallbackInstanceGenerations } from './callbackInstanceGeneration';

let generation = (
  callbackOid: bigint,
  providerConfigVersionOid: bigint | null,
  providerAuthConfigVersionOid: bigint | null,
  generationStatus: 'provisioning' | 'primary' | 'replaced'
) => ({
  callbackOid,
  providerConfigVersionOid,
  providerAuthConfigVersionOid,
  generationStatus
});

describe('selectCallbackInstanceGenerations', () => {
  it('keeps an exact primary binding', () => {
    let primary = generation(1n, 2n, 3n, 'primary');
    let replaced = generation(1n, 1n, 3n, 'replaced');
    let selected = selectCallbackInstanceGenerations({
      active: [replaced, primary],
      callbackOid: 1n,
      providerConfigVersionOid: 2n,
      providerAuthConfigVersionOid: 3n
    });

    expect(selected.primary).toBe(primary);
    expect(selected.provisioning).toBeUndefined();
    expect(selected.obsolete).toEqual([replaced]);
  });

  it('reuses an exact provisioning generation during replacement', () => {
    let oldPrimary = generation(1n, 2n, null, 'primary');
    let provisioning = generation(1n, 4n, null, 'provisioning');
    let selected = selectCallbackInstanceGenerations({
      active: [oldPrimary, provisioning],
      callbackOid: 1n,
      providerConfigVersionOid: 4n,
      providerAuthConfigVersionOid: null
    });

    expect(selected.primary).toBeUndefined();
    expect(selected.provisioning).toBe(provisioning);
    expect(selected.obsolete).toEqual([oldPrimary]);
  });

  it('treats a legacy unpinned generation as stale', () => {
    let legacyPrimary = generation(1n, null, null, 'primary');
    let selected = selectCallbackInstanceGenerations({
      active: [legacyPrimary],
      callbackOid: 1n,
      providerConfigVersionOid: 2n,
      providerAuthConfigVersionOid: null
    });

    expect(selected.primary).toBeUndefined();
    expect(selected.provisioning).toBeUndefined();
    expect(selected.obsolete).toEqual([legacyPrimary]);
  });
});
