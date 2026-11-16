import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => ({}));

import { dashboardCallbackPresenter, v1CallbackPresenter } from './callback';

let createCallback = (
  authCredentialsOrigin: 'tenant_created' | 'managed_public' | 'managed_backing' | null
) =>
  ({
    id: 'cbk_1',
    status: 'active',
    name: 'GitHub Events',
    description: null,
    metadata: null,
    integration: { id: 'int_1' },
    integrationProvider: {
      id: 'inp_1',
      currentVersion: {
        authCredentials: authCredentialsOrigin
          ? { id: 'par_1', origin: authCredentialsOrigin }
          : null
      }
    },
    provider: {
      id: 'pro_1',
      name: 'GitHub',
      description: null,
      slug: 'github',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z')
    },
    syncStatus: 'synced',
    lastSyncErrorCode: null,
    lastSyncErrorMessage: null,
    lastSyncedAt: new Date('2026-01-01T00:00:00Z'),
    triggerGroupSelections: null,
    callbackInstances: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z')
  }) as any;

describe('callback presentation', () => {
  it.each<['tenant_created' | 'managed_public' | 'managed_backing' | null, boolean]>([
    ['managed_public', true],
    ['managed_backing', true],
    ['tenant_created', false],
    [null, false]
  ])(
    'presents managed credential status for %s credentials',
    async (authCredentialsOrigin, expected) => {
      let presented = await dashboardCallbackPresenter
        .present(
          { callback: createCallback(authCredentialsOrigin) },
          {
            apiVersion: 'mt_2025_01_01_dashboard',
            accessType: 'user_auth_token'
          }
        )
        .run();

      expect(presented.auth_credentials_is_managed).toBe(expected);
    }
  );

  it.each<['tenant_created' | null, string | null]>([
    ['tenant_created', 'par_1'],
    [null, null]
  ])('presents the selected credentials for %s credentials', async (origin, expected) => {
    let presented = await dashboardCallbackPresenter
      .present(
        { callback: createCallback(origin) },
        {
          apiVersion: 'mt_2025_01_01_dashboard',
          accessType: 'user_auth_token'
        }
      )
      .run();

    expect(presented.auth_credentials_id).toBe(expected);
  });

  it('presents trigger group selection schemas with platform markers only', async () => {
    let callback = createCallback(null);
    callback.callbackInstances = [
      {
        selectableTriggerGroups: [
          {
            key: 'new_rows',
            name: 'New rows',
            description: null,
            status: 'active',
            selectionSchema: {
              type: 'object',
              required: ['spreadsheetId'],
              properties: {
                spreadsheetId: {
                  type: 'string',
                  title: 'Spreadsheet',
                  'x-slates-options-linked': { slate: '@google/drive', optionList: 'files' }
                },
                sheetId: {
                  type: 'string',
                  'x-slates-options': true,
                  'x-metorial-options': true
                }
              }
            }
          }
        ]
      }
    ];

    let presented = await v1CallbackPresenter
      .present(
        { callback },
        { apiVersion: 'mt_2026_01_01_magnetar', accessType: 'user_auth_token' }
      )
      .run();

    expect(presented.trigger_groups[0]!.selection_schema).toEqual({
      type: 'object',
      required: ['spreadsheetId'],
      properties: {
        spreadsheetId: { type: 'string', title: 'Spreadsheet' },
        sheetId: { type: 'string', 'x-metorial-options': true }
      }
    });
  });

  it('keeps managed credential status out of the public callback shape', async () => {
    let presented = await v1CallbackPresenter
      .present(
        { callback: createCallback('managed_public') },
        {
          apiVersion: 'mt_2025_01_01_dashboard',
          accessType: 'user_auth_token'
        }
      )
      .run();

    expect(presented).not.toHaveProperty('auth_credentials_is_managed');
    expect(v1CallbackPresenter.schema.properties).not.toHaveProperty(
      'auth_credentials_is_managed'
    );
  });
});
