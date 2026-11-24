import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  isGatewayEgress: vi.fn(),
  getTenantForFunctionBay: vi.fn()
}));

vi.mock('@mtsrc/mcp-runtime-db', () => ({ db: {} }));
vi.mock('@mtsrc/mcp-runtime-network', () => ({ isGatewayEgress: mocks.isGatewayEgress }));
vi.mock('@mtsrc/mcp-runtime-function-bay', () => ({
  getTenantForFunctionBay: mocks.getTenantForFunctionBay
}));

let { linkFunctionBayTenant } = await import('./functionBayTenant');

let tenant = {
  oid: BigInt(1),
  id: 'tnt_1',
  identifier: 'tenant-a',
  functionBayTenantId: null
} as any;

describe('linkFunctionBayTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTenantForFunctionBay.mockResolvedValue({ id: 'fbtn_1', identifier: 'tenant-a' });
  });

  it('links the Function Bay tenant in gateway mode', async () => {
    mocks.isGatewayEgress.mockReturnValue(true);

    let linked = await linkFunctionBayTenant(tenant);

    expect(linked.functionBayTenantId).toBe('fbtn_1');
    expect(mocks.getTenantForFunctionBay).toHaveBeenCalledWith(tenant);
  });

  it('leaves tenants alone in direct mode', async () => {
    mocks.isGatewayEgress.mockReturnValue(false);

    expect(await linkFunctionBayTenant(tenant)).toBe(tenant);
    expect(mocks.getTenantForFunctionBay).not.toHaveBeenCalled();
  });

  it('keeps the tenant when Function Bay is unreachable', async () => {
    mocks.isGatewayEgress.mockReturnValue(true);
    mocks.getTenantForFunctionBay.mockRejectedValue(new Error('unreachable'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(await linkFunctionBayTenant(tenant)).toBe(tenant);
  });
});
