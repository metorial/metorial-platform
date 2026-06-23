import { beforeEach, describe, expect, it, vi } from 'vitest';

let findFirst = vi.fn();

vi.mock('../db', () => ({
  db: {
    ssoTenantDomain: {
      findFirst
    }
  }
}));

vi.mock('../lib/jackson', () => ({
  jackson: {}
}));

describe('ssoService.getTenantByDomain', () => {
  beforeEach(() => {
    findFirst.mockReset();
  });

  it('only returns tenants that have at least one connection configured', async () => {
    let tenant = { id: 'sso_tenant_123' };
    findFirst.mockResolvedValue({
      tenant
    });

    let { ssoService } = await import('./sso');

    let result = await ssoService.getTenantByDomain({
      app: { oid: 42n } as any,
      domain: ' Example.com '
    });

    expect(result).toBe(tenant);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        appOid: 42n,
        domain: 'example.com',
        tenant: {
          status: 'completed',
          connections: {
            some: {}
          }
        }
      },
      include: {
        tenant: true
      }
    });
  });

  it('returns null when no eligible tenant domain exists', async () => {
    findFirst.mockResolvedValue(null);

    let { ssoService } = await import('./sso');

    await expect(
      ssoService.getTenantByDomain({
        app: { oid: 42n } as any,
        domain: 'example.com'
      })
    ).resolves.toBeNull();
  });
});
