import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => ({}));

import { v1CallbackTriggerSelectionOptionPresenter } from './triggerSelectionOption';

let present = (triggerSelectionOption: {
  value: string | number;
  label: string;
  description?: string | null;
}) =>
  v1CallbackTriggerSelectionOptionPresenter
    .present({ triggerSelectionOption }, {
      apiVersion: 'mt_2026_01_01_magnetar',
      accessType: 'user_auth_token'
    } as any)
    .run({});

describe('callback trigger selection option presenter', () => {
  it('presents an option', async () => {
    expect(
      await present({ value: 'folder-1', label: 'Invoices', description: 'My Drive' })
    ).toEqual({
      object: 'callback.trigger_selection_option',
      value: 'folder-1',
      label: 'Invoices',
      description: 'My Drive'
    });
  });

  it('presents a missing description as null', async () => {
    expect(await present({ value: 3, label: 'Tab' })).toMatchObject({
      value: 3,
      description: null
    });
  });
});
