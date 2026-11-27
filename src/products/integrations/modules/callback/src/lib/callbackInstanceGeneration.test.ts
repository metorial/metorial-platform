import { describe, expect, it } from 'vitest';
import {
  changedTriggerGroupKeys,
  sameTriggerGroupSelections,
  selectCallbackInstanceGenerations
} from './callbackInstanceGeneration';

let generation = (
  callbackOid: bigint,
  providerConfigVersionOid: bigint | null,
  providerAuthConfigVersionOid: bigint | null,
  generationStatus: 'provisioning' | 'primary' | 'replaced',
  triggerGroupSelections: PrismaJson.TriggerGroupSelections | null = null
) => ({
  callbackOid,
  providerConfigVersionOid,
  providerAuthConfigVersionOid,
  generationStatus,
  triggerGroupSelections
});

describe('selectCallbackInstanceGenerations', () => {
  it('keeps an exact primary binding', () => {
    let primary = generation(1n, 2n, 3n, 'primary');
    let replaced = generation(1n, 1n, 3n, 'replaced');
    let selected = selectCallbackInstanceGenerations({
      active: [replaced, primary],
      callbackOid: 1n,
      providerConfigVersionOid: 2n,
      providerAuthConfigVersionOid: 3n,
      triggerGroupSelections: null
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
      providerAuthConfigVersionOid: null,
      triggerGroupSelections: null
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
      providerAuthConfigVersionOid: null,
      triggerGroupSelections: null
    });

    expect(selected.primary).toBeUndefined();
    expect(selected.provisioning).toBeUndefined();
    expect(selected.obsolete).toEqual([legacyPrimary]);
  });

  it('starts a new generation when the trigger group selections change', () => {
    let oldPrimary = generation(1n, 2n, null, 'primary', { folders: { ids: ['a'] } });
    let selected = selectCallbackInstanceGenerations({
      active: [oldPrimary],
      callbackOid: 1n,
      providerConfigVersionOid: 2n,
      providerAuthConfigVersionOid: null,
      triggerGroupSelections: { folders: { ids: ['b'] } }
    });

    expect(selected.primary).toBeUndefined();
    expect(selected.provisioning).toBeUndefined();
    expect(selected.obsolete).toEqual([oldPrimary]);
  });

  it('keeps the primary when only the key order of the selections differs', () => {
    let primary = generation(1n, 2n, null, 'primary', { sheet: { range: 'A1:C9', id: 's' } });
    let selected = selectCallbackInstanceGenerations({
      active: [primary],
      callbackOid: 1n,
      providerConfigVersionOid: 2n,
      providerAuthConfigVersionOid: null,
      triggerGroupSelections: { sheet: { id: 's', range: 'A1:C9' } }
    });

    expect(selected.primary).toBe(primary);
  });
});

describe('sameTriggerGroupSelections', () => {
  it('treats missing and empty selections as equal', () => {
    expect(sameTriggerGroupSelections(null, {})).toBe(true);
    expect(sameTriggerGroupSelections(undefined, null)).toBe(true);
    expect(sameTriggerGroupSelections({ a: {} }, {})).toBe(false);
  });
});

describe('changedTriggerGroupKeys', () => {
  it('lists added, removed and edited groups, ignoring key order', () => {
    expect(
      changedTriggerGroupKeys(
        { kept: { id: 's', range: 'A1' }, edited: { ids: ['a'] }, removed: {} },
        { added: {}, edited: { ids: ['a', 'b'] }, kept: { range: 'A1', id: 's' } }
      )
    ).toEqual(['added', 'edited', 'removed']);
  });

  it('reports nothing when both sides are empty or missing', () => {
    expect(changedTriggerGroupKeys(null, {})).toEqual([]);
    expect(changedTriggerGroupKeys(undefined, null)).toEqual([]);
  });
});
