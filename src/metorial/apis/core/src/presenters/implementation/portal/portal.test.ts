import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  getPortalAllowedRedirectUrlFilters: vi.fn(() => []),
  getPortalUrls: vi.fn()
}));

vi.mock('@metorial/module-consumer', () => ({
  getPortalAllowedRedirectUrlFilters: mocks.getPortalAllowedRedirectUrlFilters,
  portalService: {
    getPortalUrls: mocks.getPortalUrls
  }
}));

import { v1PortalPresenter } from './portal';

let presenterContext = {
  apiVersion: 'mt_2025_01_01_dashboard',
  accessType: 'user_auth_token'
} as const;

describe('v1PortalPresenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves portal URLs before presenting them', async () => {
    let urls = [{ type: 'namespace', url: 'https://portal.example.com' }];
    mocks.getPortalUrls.mockResolvedValue(urls);

    let result = await v1PortalPresenter
      .present(
        {
          portal: {
            id: 'ptl_test',
            status: 'active',
            name: 'Test Portal',
            slug: 'test-portal',
            description: 'Test portal',
            allowedRedirectUrlFilters: null,
            createdAt: new Date('2026-08-12T00:00:00.000Z'),
            updatedAt: new Date('2026-08-12T00:00:00.000Z'),
            surface: {
              allowConsumerSkillAuthoring: false,
              allowConsumerSkillPublishing: false,
              sessionExpiryTimeInSeconds: 3600,
              skillConfiguration: {
                id: 'skc_test',
                isDefault: true,
                allowScripts: false,
                allowedFileExtensions: [],
                allowNonStandardDirectories: false
              }
            }
          } as any,
          portalUrl: 'https://fallback.example.com',
          namespaces: [] as any
        },
        presenterContext
      )
      .run();

    expect(result.urls).toEqual(urls);
  });
});
