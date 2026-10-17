import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSessionlessMcpEnabled } from './sessionless';

describe('isSessionlessMcpEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ['development', 'production', true],
    ['staging', 'production', true],
    ['production', 'production', false],
    ['production', 'development', false]
  ])('METORIAL_ENV=%s NODE_ENV=%s -> %s', (metorialEnv, nodeEnv, expected) => {
    vi.stubEnv('METORIAL_ENV', metorialEnv);
    vi.stubEnv('NODE_ENV', nodeEnv);

    expect(isSessionlessMcpEnabled()).toBe(expected);
  });

  it('falls back to NODE_ENV when METORIAL_ENV is unset', () => {
    vi.stubEnv('METORIAL_ENV', '');

    vi.stubEnv('NODE_ENV', 'development');
    expect(isSessionlessMcpEnabled()).toBe(true);

    vi.stubEnv('NODE_ENV', 'production');
    expect(isSessionlessMcpEnabled()).toBe(false);
  });
});
