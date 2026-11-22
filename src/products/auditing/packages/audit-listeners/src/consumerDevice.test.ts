import { beforeEach, describe, expect, it, vi } from 'vitest';

let { recordEvent, addAfterTransactionHook } = vi.hoisted(() => ({
  recordEvent: vi.fn(),
  addAfterTransactionHook: vi.fn(async (hook: () => Promise<void>) => await hook())
}));

vi.mock('@metorial/module-audit-tracker', () => ({
  auditTrackerService: { recordEvent }
}));

vi.mock('@metorial/db', () => ({ addAfterTransactionHook }));

vi.mock('@metorial/fabric', () => ({
  Fabric: { listen: vi.fn() }
}));

import { recordConsumerDeviceSettingsUpdated } from './consumerDevice';

let auditScope = {
  organizationOid: 1n,
  instanceOid: 3n,
  organizationActorOid: 4n,
  actor: { type: 'org_actor' as const, id: 'oac_1' },
  context: { ip: '127.0.0.1' }
};

let decidedAt = new Date('2026-11-22T10:00:00Z');

let settings = {
  oid: 6n,
  id: 'cods_1',
  aiToolDetectionEnabled: true,
  privacyNoticeAcceptedAt: decidedAt,
  privacyNoticeAcceptedByActorOid: 4n,
  instanceOid: 3n,
  createdAt: decidedAt,
  updatedAt: decidedAt
};

describe('consumer device audit listeners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recordEvent.mockResolvedValue(undefined);
  });

  it('records device settings without actor internals', async () => {
    await recordConsumerDeviceSettingsUpdated({
      consumerDeviceSettings: settings,
      previousConsumerDeviceSettings: { ...settings, aiToolDetectionEnabled: false },
      auditScope
    } as any);

    let [, resource, action, data] = recordEvent.mock.calls[0]!;
    expect([resource, action]).toEqual(['consumer_device_settings', 'update']);
    expect(data.payload).toEqual({
      id: 'cods_1',
      aiToolDetectionEnabled: true,
      privacyNoticeAcceptedAt: decidedAt
    });
    expect(data.previousPayload.aiToolDetectionEnabled).toBe(false);
  });
});
