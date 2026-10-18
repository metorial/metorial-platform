import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSessionlessMcpEnabled } from './sessionless';

describe('isSessionlessMcpEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('follows the global default while the tenant has no override', () => {
    vi.stubEnv('METORIAL_ENV', 'staging');
    expect(isSessionlessMcpEnabled({ sessionlessMcpEnabled: null })).toBe(true);

    vi.stubEnv('METORIAL_ENV', 'production');
    expect(isSessionlessMcpEnabled({ sessionlessMcpEnabled: null })).toBe(false);
  });

  it('lets a tenant override win over the global default', () => {
    vi.stubEnv('METORIAL_ENV', 'production');
    expect(isSessionlessMcpEnabled({ sessionlessMcpEnabled: true })).toBe(true);

    vi.stubEnv('METORIAL_ENV', 'staging');
    expect(isSessionlessMcpEnabled({ sessionlessMcpEnabled: false })).toBe(false);
  });
});
