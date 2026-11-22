import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  isFlagEnabledForScope: vi.fn(),
  isAiToolDetectionEnabled: vi.fn()
}));

vi.mock('@metorial/module-flags', () => ({
  flagService: { isFlagEnabledForScope: mocks.isFlagEnabledForScope }
}));

vi.mock('@metorial/module-consumer-core', async () => ({
  ...(await import('@metorial/module-consumer-core/src/lib/aiToolDetection')),
  consumerDeviceSettingsService: { isAiToolDetectionEnabled: mocks.isAiToolDetectionEnabled }
}));

import { withVisibleDetections } from '../../lib/aiToolDetection';
import {
  getDeviceMonitor,
  requireDetectionCatalog,
  requireDetectionReporting
} from './deviceDetection';

let ctx = {
  organization: { id: 'org_1' },
  project: { id: 'proj_1' },
  instance: { oid: 3n }
} as any;

describe('AI tool detection gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAiToolDetectionEnabled.mockResolvedValue(true);
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
      flag: 'ai-tool-detection'
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
      mocks.isAiToolDetectionEnabled.mockResolvedValue(enabled);

      expect((await getDeviceMonitor(ctx)).aiToolDetection).toBe(expected);
    }
  );

  it('hides detections on devices unless detection is visible', () => {
    let device = { id: 'codv_1', detections: [{ toolKey: 'cursor' }] };

    expect(withVisibleDetections(device, false).detections).toEqual([]);
    expect(withVisibleDetections(device, true)).toBe(device);
  });
});
