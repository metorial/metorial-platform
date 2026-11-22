import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  isFlagEnabledForScope: vi.fn(),
  getSettings: vi.fn()
}));

vi.mock('@metorial/module-consumer-core', async () => {
  let isAiToolDetectionFlagged = async (d: any) =>
    await mocks.isFlagEnabledForScope({
      organization: d.organization,
      project: d.project,
      flag: 'ai-tool-detection-enabled'
    });

  return {
    ...(await import('@metorial/module-consumer-core/src/lib/aiToolDetection')),
    consumerDeviceSettingsService: {
      isAiToolDetectionFlagged,
      isAiToolDetectionActive: async (d: any) =>
        !!(await mocks.getSettings())?.aiToolDetectionEnabled &&
        (await isAiToolDetectionFlagged(d))
    }
  };
});

vi.mock('../middleware/checkAccess', () => ({ hasAccess: vi.fn() }));

vi.mock('@metorial/module-agent-tracking-query', () => ({
  agentTrackingAgentActivityService: {}
}));

import {
  assertCanTurnOnDetection,
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
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSettings.mockResolvedValue({ aiToolDetectionEnabled: true });
  });

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
      mocks.getSettings.mockResolvedValue({ aiToolDetectionEnabled: enabled });

      expect((await getDeviceMonitor(ctx)).aiToolDetection).toBe(expected);
    }
  );

  it('hides detections on devices unless detection is visible', () => {
    let device = { id: 'codv_1', detections: [{ toolKey: 'cursor' }] };

    expect(withVisibleDetections(device, false).detections).toEqual([]);
    expect(withVisibleDetections(device, true)).toBe(device);
  });
});

describe('turning on AI tool detection', () => {
  let dashboardUser = { auth: { type: 'user' } } as any;

  it.each([{ aiToolDetectionEnabled: true }, { privacyNoticeAccepted: true }])(
    'requires a person signed in to the dashboard for %o',
    input => {
      expect(() => assertCanTurnOnDetection(dashboardUser, input)).not.toThrow();

      for (let auth of [{ type: 'machine' }, { type: 'user', machineAccess: {} }]) {
        expect(() => assertCanTurnOnDetection({ auth } as any, input)).toThrow(
          expect.objectContaining({ data: expect.objectContaining({ status: 403 }) })
        );
      }
    }
  );

  it('lets any caller turn detection off or withdraw the notice', () => {
    let apiKey = { auth: { type: 'machine' } } as any;

    expect(() =>
      assertCanTurnOnDetection(apiKey, {
        aiToolDetectionEnabled: false,
        privacyNoticeAccepted: false
      })
    ).not.toThrow();
    expect(() => assertCanTurnOnDetection(apiKey, {})).not.toThrow();
  });
});
