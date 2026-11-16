import { describe, expect, it } from 'vitest';
import {
  type CallbackRegistrationSync,
  getCallbackRegistrationState,
  sameTriggerGroupSelections
} from './callbackRegistrationState';

let synced: CallbackRegistrationSync = {
  status: 'synced',
  error: null,
  syncedAt: new Date('2026-11-14T10:00:00Z')
};
let pending: CallbackRegistrationSync = { status: 'pending', error: null, syncedAt: null };
let failed: CallbackRegistrationSync = {
  status: 'failed',
  error: { code: 'provider_error', message: 'The provider rejected the registration.' },
  syncedAt: null
};

let savedAt = new Date('2026-11-14T12:00:00Z');
let before = new Date('2026-11-14T11:00:00Z');
let after = new Date('2026-11-14T12:00:05Z');
let later = new Date('2026-11-14T12:00:10Z');

let instance = (sync: CallbackRegistrationSync, createdAt = before, connection = 'iip_a') => ({
  sync,
  createdAt,
  integrationInstanceProviderId: connection
});

describe('callback registration state', () => {
  it('is registering while the callback itself is pending', () => {
    expect(
      getCallbackRegistrationState({
        callback: { sync: pending },
        callbackInstances: [],
        selectionsChangedAt: null
      })
    ).toEqual({ status: 'registering' });
  });

  it('is registering while the newest generation of a connection is pending', () => {
    expect(
      getCallbackRegistrationState({
        callback: { sync: synced },
        callbackInstances: [instance(synced), instance(pending, after, 'iip_b')],
        selectionsChangedAt: null
      })
    ).toEqual({ status: 'registering' });
    expect(
      getCallbackRegistrationState({
        callback: { sync: synced },
        callbackInstances: [instance(pending, after), instance(synced, before)],
        selectionsChangedAt: null
      })
    ).toEqual({ status: 'registering' });
  });

  it('is settled once the callback and the newest generation of every connection are synced', () => {
    expect(
      getCallbackRegistrationState({
        callback: { sync: synced },
        callbackInstances: [instance(synced), instance(synced, before, 'iip_b')],
        selectionsChangedAt: null
      })
    ).toEqual({ status: 'settled' });
    expect(
      getCallbackRegistrationState({
        callback: { sync: synced },
        callbackInstances: [],
        selectionsChangedAt: savedAt
      })
    ).toEqual({ status: 'settled' });
  });

  it('reports the failure of the callback', () => {
    expect(
      getCallbackRegistrationState({
        callback: { sync: failed },
        callbackInstances: [instance(pending)],
        selectionsChangedAt: null
      })
    ).toEqual({ status: 'failed', sync: failed });
  });

  it('reports the failure of the newest generation once nothing is pending', () => {
    expect(
      getCallbackRegistrationState({
        callback: { sync: synced },
        callbackInstances: [instance(synced), instance(failed, before, 'iip_b')],
        selectionsChangedAt: null
      })
    ).toEqual({ status: 'failed', sync: failed });
    expect(
      getCallbackRegistrationState({
        callback: { sync: synced },
        callbackInstances: [instance(failed, after), instance(pending, after, 'iip_b')],
        selectionsChangedAt: savedAt
      })
    ).toEqual({ status: 'registering' });
  });

  it('ignores an older generation of a connection that a newer one replaces', () => {
    expect(
      getCallbackRegistrationState({
        callback: { sync: synced },
        callbackInstances: [instance(synced, later), instance(failed, after)],
        selectionsChangedAt: savedAt
      })
    ).toEqual({ status: 'settled' });
    expect(
      getCallbackRegistrationState({
        callback: { sync: synced },
        callbackInstances: [instance(failed, before), instance(synced, after)],
        selectionsChangedAt: null
      })
    ).toEqual({ status: 'settled' });
    expect(
      getCallbackRegistrationState({
        callback: { sync: synced },
        callbackInstances: [instance(synced, before), instance(failed, after)],
        selectionsChangedAt: null
      })
    ).toEqual({ status: 'failed', sync: failed });
  });

  it('is registering after a selection change until each connection has a newer generation', () => {
    expect(
      getCallbackRegistrationState({
        callback: { sync: synced },
        callbackInstances: [instance(synced, before)],
        selectionsChangedAt: savedAt
      })
    ).toEqual({ status: 'registering' });
    expect(
      getCallbackRegistrationState({
        callback: { sync: synced },
        callbackInstances: [instance(synced, after), instance(synced, before, 'iip_b')],
        selectionsChangedAt: savedAt
      })
    ).toEqual({ status: 'registering' });
    expect(
      getCallbackRegistrationState({
        callback: { sync: synced },
        callbackInstances: [instance(synced, after), instance(synced, before)],
        selectionsChangedAt: savedAt
      })
    ).toEqual({ status: 'settled' });
  });

  it('does not report the old failure of a generation a selection change replaces', () => {
    expect(
      getCallbackRegistrationState({
        callback: { sync: synced },
        callbackInstances: [instance(failed, before)],
        selectionsChangedAt: savedAt
      })
    ).toEqual({ status: 'registering' });
    expect(
      getCallbackRegistrationState({
        callback: { sync: synced },
        callbackInstances: [instance(failed, after), instance(failed, before, 'iip_b')],
        selectionsChangedAt: savedAt
      })
    ).toEqual({ status: 'failed', sync: failed });
  });
});

describe('trigger group selection comparison', () => {
  it('ignores key order and treats no selections as empty', () => {
    expect(
      sameTriggerGroupSelections(
        { folders: { ids: ['a'], recursive: true } },
        { folders: { recursive: true, ids: ['a'] } }
      )
    ).toBe(true);
    expect(sameTriggerGroupSelections(null, {})).toBe(true);
    expect(sameTriggerGroupSelections(undefined, null)).toBe(true);
  });

  it('notices a changed value or order of a list', () => {
    expect(
      sameTriggerGroupSelections({ folders: { ids: ['a'] } }, { folders: { ids: ['b'] } })
    ).toBe(false);
    expect(
      sameTriggerGroupSelections(
        { folders: { ids: ['a', 'b'] } },
        { folders: { ids: ['b', 'a'] } }
      )
    ).toBe(false);
    expect(sameTriggerGroupSelections(null, { folders: { ids: ['a'] } })).toBe(false);
  });
});
