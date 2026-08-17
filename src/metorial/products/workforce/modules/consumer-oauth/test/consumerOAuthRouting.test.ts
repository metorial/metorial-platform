import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_: string, factory: () => unknown) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial/config', () => ({
  getConfig: () => ({
    urls: {
      apiUrl: 'https://api.metorial.test'
    }
  })
}));

vi.mock('@metorial/db', () => ({
  db: {
    portal: {
      findFirst: vi.fn()
    },
    consumerSurface: {
      findFirst: vi.fn()
    }
  }
}));

vi.mock('@metorial/module-magic', () => ({
  resolveMagicMcpTargetByIdOrAlias: vi.fn()
}));

vi.mock('@metorial/module-portal', () => ({
  portalService: {
    getPortalPublic: vi.fn()
  }
}));

import { db } from '@metorial/db';
import { resolveMagicMcpTargetByIdOrAlias } from '@metorial/module-magic';
import { portalService } from '@metorial/module-portal';
import { consumerOAuthRoutingService } from '../src/services/routing';

describe('consumerOAuthRoutingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves MCP portal routes without enriching the portal', async () => {
    (db.portal.findFirst as any).mockResolvedValue({
      instance: {
        oid: 10n,
        id: 'ins_1'
      }
    });
    vi.mocked(resolveMagicMcpTargetByIdOrAlias).mockResolvedValue({
      type: 'server',
      target: {
        oid: 20n,
        instance: {
          oid: 10n
        }
      }
    } as any);

    let route = await consumerOAuthRoutingService.resolvePortalMcpRoute({
      portalId: 'portal_1',
      magicMcpTargetId: 'target_1'
    });

    expect(portalService.getPortalPublic).not.toHaveBeenCalled();
    expect(db.portal.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ id: 'portal_1' }, { slug: 'portal_1' }]
        })
      })
    );
    expect(route.portal).toBeNull();
    expect(route.consumerSurface).toBeNull();
    expect(route.instance.id).toBe('ins_1');
    expect(route.magicMcpTarget?.target.oid).toBe(20n);
  });
});
