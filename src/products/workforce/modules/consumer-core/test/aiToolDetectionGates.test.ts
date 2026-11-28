import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  flagged: true,
  settings: null as null | { aiToolDetectionEnabled: boolean; connectionMode: string },
  findUnique: vi.fn(),
  isFlagEnabledForScope: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: {},
  ID: { generateId: vi.fn(async (prefix: string) => `${prefix}_generated`) },
  addAfterTransactionHook: vi.fn(),
  withTransaction: vi.fn(async (callback: any) =>
    callback({
      $queryRaw: vi.fn(async () => []),
      consumerDeviceSettings: {
        findUnique: mocks.findUnique,
        upsert: vi.fn(async (query: any) => query.create)
      },
      consumerDevice: { updateMany: vi.fn() },
      consumerDeviceDetection: { deleteMany: vi.fn() }
    })
  )
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_: string, factory: () => unknown) => ({ build: () => factory() }))
  }
}));

vi.mock('@metorial/fabric', () => ({ Fabric: { fire: vi.fn() } }));

vi.mock('@metorial/module-flags', () => ({
  flagService: { isFlagEnabledForScope: mocks.isFlagEnabledForScope }
}));

vi.mock('../src/services/aiToolPolicy', () => ({ aiToolPolicyService: {} }));

vi.mock('../src/services/consumerDevice', () => ({ consumerDeviceInclude: {} }));

import { consumerDeviceDetectionService } from '../src/services/consumerDeviceDetection';
import { consumerDeviceSettingsService } from '../src/services/consumerDeviceSettings';

let scope = {
  organization: { id: 'org_1' },
  project: { id: 'proj_1' },
  instance: { oid: 3n }
} as any;

let update = (
  input: Parameters<typeof consumerDeviceSettingsService.updateSettings>[0]['input'],
  isHuman = true
) =>
  consumerDeviceSettingsService.updateSettings({
    ...scope,
    auditScope: {} as any,
    actor: { isHuman },
    input
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.flagged = true;
  mocks.settings = null;
  mocks.findUnique.mockImplementation(async () => mocks.settings);
  mocks.isFlagEnabledForScope.mockImplementation(async () => mocks.flagged);
});

describe('AI tool detection flag', () => {
  it('refuses reports and hides the catalog while the flag is off', async () => {
    mocks.flagged = false;

    await expect(
      consumerDeviceDetectionService.reportDetections({
        ...scope,
        consumerDevice: { oid: 9n, oauthTokenOid: 50n, status: 'active' } as any,
        oauthToken: { oid: 50n },
        auditScope: {} as any,
        input: { seq: 1, generatedAt: new Date(), findings: [] }
      })
    ).rejects.toMatchObject({ data: { status: 403, code: 'detection_disabled' } });
    await expect(consumerDeviceDetectionService.getCatalog(scope)).rejects.toMatchObject({
      data: { status: 404, code: 'not_found' }
    });
    expect(mocks.isFlagEnabledForScope).toHaveBeenCalledWith({
      organization: scope.organization,
      project: scope.project,
      flag: 'ai-tool-detection-enabled'
    });
  });

  it('hands out the catalog while the flag is on', async () => {
    expect((await consumerDeviceDetectionService.getCatalog(scope)).version).toEqual(
      expect.any(String)
    );
  });
});

describe('consumerDeviceSettingsService.getDeviceViews', () => {
  let device = { id: 'codv_1', detections: [{ toolKey: 'cursor' }] };

  it.each([
    [false, true, false],
    [true, false, false],
    [true, true, true]
  ])(
    'monitors AI tools only with the flag (%s) and the setting (%s) on',
    async (flagged, enabled, expected) => {
      mocks.flagged = flagged;
      mocks.settings = { aiToolDetectionEnabled: enabled, connectionMode: 'direct' };

      let view = await consumerDeviceSettingsService.getDeviceViews({
        ...scope,
        consumerDevices: [device]
      });

      expect(view.monitor.aiToolDetection).toBe(expected);
      expect(view.install).toEqual({ connectionMode: 'direct' });
    }
  );

  it('monitors nothing and proxies locally before the instance has settings', async () => {
    let view = await consumerDeviceSettingsService.getDeviceViews({
      ...scope,
      consumerDevices: [device]
    });

    expect(view.monitor.aiToolDetection).toBe(false);
    expect(view.install).toEqual({ connectionMode: 'local_proxy' });
  });

  it('hides detections while the organization has no AI tool detection', async () => {
    mocks.flagged = false;
    let hidden = await consumerDeviceSettingsService.getDeviceViews({
      ...scope,
      consumerDevices: [device]
    });
    expect(hidden.consumerDevices[0]!.detections).toEqual([]);

    mocks.flagged = true;
    let shown = await consumerDeviceSettingsService.getDeviceViews({
      ...scope,
      consumerDevices: [device]
    });
    expect(shown.consumerDevices[0]).toBe(device);
  });

  it('hides detections for dashboard reads without reading the device settings', async () => {
    mocks.flagged = false;
    let [hidden] = await consumerDeviceSettingsService.withVisibleDetections({
      ...scope,
      consumerDevices: [device]
    });
    expect(hidden!.detections).toEqual([]);

    mocks.flagged = true;
    let [shown] = await consumerDeviceSettingsService.withVisibleDetections({
      ...scope,
      consumerDevices: [device]
    });
    expect(shown).toBe(device);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
});

describe('consumerDeviceSettingsService.updateSettings', () => {
  it.each([
    { aiToolDetectionEnabled: true },
    { aiToolDetectionEnabled: false },
    { privacyNoticeAccepted: true }
  ])('refuses %o while the organization has no AI tool detection', async input => {
    mocks.flagged = false;

    await expect(update(input)).rejects.toMatchObject({ data: { status: 403 } });
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('changes the connection mode without AI tool detection', async () => {
    mocks.flagged = false;

    expect(await update({ connectionMode: 'direct' })).toMatchObject({
      connectionMode: 'direct'
    });
    expect(mocks.isFlagEnabledForScope).not.toHaveBeenCalled();
  });

  it.each([
    { aiToolDetectionEnabled: true },
    { privacyNoticeAccepted: true },
    { connectionMode: 'direct' as const }
  ])('requires a person signed in to the dashboard for %o', async input => {
    await expect(update(input, false)).rejects.toMatchObject({ data: { status: 403 } });
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('lets anyone turn detection off, withdraw the notice or go back to the local proxy', async () => {
    mocks.settings = { aiToolDetectionEnabled: false, connectionMode: 'direct' };

    expect(
      await update(
        {
          aiToolDetectionEnabled: false,
          privacyNoticeAccepted: false,
          connectionMode: 'local_proxy'
        },
        false
      )
    ).toMatchObject({ connectionMode: 'local_proxy' });
  });
});
