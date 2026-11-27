import { v } from '@lowerdeck/validation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Controller,
  Group,
  Handler,
  Path
} from '../../../../../../../../platform/packages/rest/src/controller';

let mocks = vi.hoisted(() => ({
  getCallbackById: vi.fn(),
  listTriggerSelectionOptions: vi.fn()
}));

vi.mock('@metorial/rest', () => ({ Controller, Group, Handler, Path }));
vi.mock('@metorial-subspace/module-callback', () => ({
  callbackService: {
    getCallbackById: mocks.getCallbackById,
    listTriggerSelectionOptions: mocks.listTriggerSelectionOptions
  },
  triggerGroupSelectionsSchema: v.record(v.record(v.any()))
}));
vi.mock('@metorial/presenters', () => ({
  callbackTriggerSelectionOptionPresenter: { introspect: () => null }
}));
vi.mock('../../../lib/ownershipActor', () => ({ getOwnershipActor: vi.fn() }));
vi.mock('../../../middleware/apiGroup', () => ({ apiGroup: Group.create() }));
vi.mock('../../../middleware/organizationGroup', () => ({
  organizationGroup: Group.create()
}));
vi.mock('../../../middleware/checkAccess', () => ({ checkAccess: () => async () => ({}) }));
vi.mock('../../../middleware/hasFlags', () => ({ hasFlags: () => async () => ({}) }));
vi.mock('../../../middleware/instanceGroup', () => ({
  instanceGroup: Group.create(),
  instancePath: (path: string, sdkPath: string) => [
    Path(`/${path}`, sdkPath),
    Path(`/instances/:instanceId/${path}`, `management.instance.${sdkPath}`),
    Path(`/dashboard/instances/:instanceId/${path}`, `dashboard.instance.${sdkPath}`)
  ]
}));

let { callbackTriggerSelectionOptionController } =
  await import('./callbackTriggerSelectionOption');

let list = () => {
  let handler = callbackTriggerSelectionOptionController.handlers.list;
  if (!(handler instanceof Handler)) throw new Error('Expected a list handler');

  return handler;
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('callback trigger selection options endpoint', () => {
  it('is a GET on one dashboard route and hidden from the docs', () => {
    let endpoint = list().introspect({ apiVersion: 'mt_2025_01_01_dashboard' });

    expect(endpoint.method).toBe('get');
    expect(endpoint.allPaths).toEqual([
      {
        path: '/dashboard/instances/:instanceId/callback-trigger-selection-options',
        sdkPath: 'dashboard.instance.callbackTriggerSelectionOptions.list'
      }
    ]);
    expect(endpoint.hideInDocs).toBe(true);
  });

  it.each([
    ['an API key', { type: 'machine' }],
    ['a fine-grained token', { type: 'fine_grained' }],
    ['a user session through machine access', { type: 'user', machineAccess: {} }]
  ])('rejects %s before reading the callback', async (_, auth) => {
    let request = {
      body: {},
      query: { callback_id: 'cb_1', trigger_group_key: 'folder_events', field: 'folderIds' },
      apiVersion: 'mt_2025_01_01_dashboard',
      auth,
      params: { instanceId: 'ins_1' },
      sharedMiddlewareMemo: new Map()
    } as any;

    await expect(list().run(request, { instance: { id: 'ins_1' } })).rejects.toMatchObject({
      data: { status: 403 }
    });
    expect(mocks.getCallbackById).not.toHaveBeenCalled();
    expect(mocks.listTriggerSelectionOptions).not.toHaveBeenCalled();
  });
});
