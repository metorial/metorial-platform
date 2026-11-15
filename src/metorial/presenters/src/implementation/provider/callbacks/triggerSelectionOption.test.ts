import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => ({}));

import { v1CallbackTriggerSelectionOptionListPresenter } from './triggerSelectionOption';

let drive = {
  id: 'pro_drive',
  name: 'Google Drive',
  description: null,
  slug: 'google-drive',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z')
} as any;

let present = (
  source: 'own' | 'linked',
  linkedProvider: { provider: any; connected: boolean } | null
) =>
  v1CallbackTriggerSelectionOptionListPresenter
    .present(
      {
        triggerSelectionOptions: {
          options: [{ value: 'sheet-1', label: 'Customer Orders' }],
          nextPageToken: null,
          source,
          linkedProvider
        }
      },
      { apiVersion: 'mt_2026_01_01_magnetar', accessType: 'user_auth_token' } as any
    )
    .run();

describe('trigger selection option list presentation', () => {
  it("presents options from the callback's own connection without a linked provider", async () => {
    let presented = await present('own', null);

    expect(presented).toMatchObject({
      object: 'list',
      items: [
        {
          object: 'callback.trigger_selection_option',
          value: 'sheet-1',
          label: 'Customer Orders',
          description: null
        }
      ],
      source: 'callback',
      linked_provider: null,
      next_page_token: null
    });
  });

  it("presents options listed with the linked provider's connection", async () => {
    let presented = await present('linked', { provider: drive, connected: true });

    expect(presented.source).toBe('linked_provider');
    expect(presented.linked_provider).toEqual({
      object: 'callback.trigger_selection_linked_provider',
      provider: expect.objectContaining({
        object: 'provider#preview',
        id: 'pro_drive',
        name: 'Google Drive'
      }),
      connection_status: 'connected'
    });
  });

  it('names a linked provider that is not connected yet', async () => {
    let presented = await present('own', { provider: drive, connected: false });

    expect(presented.source).toBe('callback');
    expect(presented.linked_provider).toMatchObject({
      provider: { id: 'pro_drive' },
      connection_status: 'not_connected'
    });
  });

  it.each<[string, 'own' | 'linked', { provider: any; connected: boolean } | null]>([
    ['no linked provider', 'own', null],
    ['a connected linked provider', 'linked', { provider: drive, connected: true }],
    ['a linked provider that is not connected', 'own', { provider: drive, connected: false }]
  ])('matches its schema with %s', async (_, source, linked) => {
    let presented = await present(source, linked);

    expect(
      v1CallbackTriggerSelectionOptionListPresenter.schema.validate(presented).success
    ).toBe(true);
  });
});
