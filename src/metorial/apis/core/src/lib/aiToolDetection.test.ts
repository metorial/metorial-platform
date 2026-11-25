import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({ isFlagEnabledForScope: vi.fn() }));

vi.mock('@metorial/module-consumer-core', async () => ({
  ...(await import('@metorial/module-consumer-core/src/lib/aiToolDetection')),
  consumerDeviceSettingsService: {
    isAiToolDetectionFlagged: async (d: any) =>
      await mocks.isFlagEnabledForScope({
        organization: d.organization,
        project: d.project,
        flag: 'ai-tool-detection-enabled'
      })
  }
}));

import {
  assertCanTurnOnDeviceSettings,
  assertDetectionSettingsAvailable,
  getDeviceMonitor,
  requireDetectionCatalog,
  requireDetectionReporting,
  withVisibleDetections
} from './aiToolDetection';

let ctx = {
  organization: { id: 'org_1' },
  project: { id: 'proj_1' },
  instance: { oid: 3n }
} as any;

describe('AI tool detection gates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses reports and hides the catalog while the flag is off', async () => {
    mocks.isFlagEnabledForScope.mockResolvedValue(false);

    await expect(requireDetectionReporting(ctx)).rejects.toMatchObject({
      data: { status: 403, code: 'detection_disabled' }
    });
    await expect(requireDetectionCatalog(ctx)).rejects.toMatchObject({
      data: { status: 404, code: 'not_found' }
    });
    expect(mocks.isFlagEnabledForScope).toHaveBeenCalledWith({
      organization: ctx.organization,
      project: ctx.project,
      flag: 'ai-tool-detection-enabled'
    });
  });

  it('lets reports and the catalog through while the flag is on', async () => {
    mocks.isFlagEnabledForScope.mockResolvedValue(true);

    await expect(requireDetectionReporting(ctx)).resolves.toBeUndefined();
    await expect(requireDetectionCatalog(ctx)).resolves.toBeUndefined();
  });

  it.each([
    [false, true, false],
    [true, false, false],
    [true, true, true]
  ])(
    'monitors AI tools only with the flag (%s) and the setting (%s) on',
    async (flagged, enabled, expected) => {
      mocks.isFlagEnabledForScope.mockResolvedValue(flagged);

      expect(
        (await getDeviceMonitor(ctx, { aiToolDetectionEnabled: enabled })).aiToolDetection
      ).toBe(expected);
    }
  );

  it('monitors nothing before the instance has settings', async () => {
    mocks.isFlagEnabledForScope.mockResolvedValue(true);

    expect((await getDeviceMonitor(ctx, null)).aiToolDetection).toBe(false);
  });

  it.each([
    { aiToolDetectionEnabled: true },
    { aiToolDetectionEnabled: false },
    { privacyNoticeAccepted: true }
  ])('refuses %o while the organization has no AI tool detection', async input => {
    mocks.isFlagEnabledForScope.mockResolvedValue(false);

    await expect(assertDetectionSettingsAvailable(ctx, input)).rejects.toMatchObject({
      data: { status: 403 }
    });
  });

  it('lets the connection mode through without AI tool detection', async () => {
    mocks.isFlagEnabledForScope.mockResolvedValue(false);

    await expect(
      assertDetectionSettingsAvailable(ctx, { connectionMode: 'direct' })
    ).resolves.toBeUndefined();
    expect(mocks.isFlagEnabledForScope).not.toHaveBeenCalled();
  });

  it('lets detection settings through where detection is available', async () => {
    mocks.isFlagEnabledForScope.mockResolvedValue(true);

    await expect(
      assertDetectionSettingsAvailable(ctx, { privacyNoticeAccepted: true })
    ).resolves.toBeUndefined();
  });

  it('hides detections on devices unless detection is visible', () => {
    let device = { id: 'codv_1', detections: [{ toolKey: 'cursor' }] };

    expect(withVisibleDetections(device, false).detections).toEqual([]);
    expect(withVisibleDetections(device, true)).toBe(device);
  });
});

describe('device settings that need a person in the dashboard', () => {
  let dashboardUser = { auth: { type: 'user' } } as any;
  let apiKey = { auth: { type: 'machine' } } as any;

  it.each([
    { aiToolDetectionEnabled: true },
    { privacyNoticeAccepted: true },
    { connectionMode: 'direct' as const }
  ])('requires a person signed in to the dashboard for %o', input => {
    expect(() => assertCanTurnOnDeviceSettings(dashboardUser, input)).not.toThrow();

    for (let auth of [{ type: 'machine' }, { type: 'user', machineAccess: {} }]) {
      expect(() => assertCanTurnOnDeviceSettings({ auth } as any, input)).toThrow(
        expect.objectContaining({ data: expect.objectContaining({ status: 403 }) })
      );
    }
  });

  it('lets any caller turn detection off, withdraw the notice or go back to the local proxy', () => {
    expect(() =>
      assertCanTurnOnDeviceSettings(apiKey, {
        aiToolDetectionEnabled: false,
        privacyNoticeAccepted: false,
        connectionMode: 'local_proxy'
      })
    ).not.toThrow();
    expect(() => assertCanTurnOnDeviceSettings(apiKey, {})).not.toThrow();
  });
});
