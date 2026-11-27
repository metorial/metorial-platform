import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getDefaultSessionlessMcpEnabled,
  resolveSessionlessMcpEnabled
} from './sessionlessMcp';

describe('getDefaultSessionlessMcpEnabled', () => {
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

    expect(getDefaultSessionlessMcpEnabled()).toBe(expected);
  });

  it('falls back to NODE_ENV when METORIAL_ENV is unset', () => {
    vi.stubEnv('METORIAL_ENV', '');

    vi.stubEnv('NODE_ENV', 'development');
    expect(getDefaultSessionlessMcpEnabled()).toBe(true);

    vi.stubEnv('NODE_ENV', 'production');
    expect(getDefaultSessionlessMcpEnabled()).toBe(false);
  });
});

describe('resolveSessionlessMcpEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([null, undefined])(
    'uses the global default when the project value is %s',
    configured => {
      vi.stubEnv('METORIAL_ENV', 'staging');
      expect(resolveSessionlessMcpEnabled(configured)).toBe(true);

      vi.stubEnv('METORIAL_ENV', 'production');
      expect(resolveSessionlessMcpEnabled(configured)).toBe(false);
    }
  );

  it('lets an explicit project value override the global default in both directions', () => {
    vi.stubEnv('METORIAL_ENV', 'production');
    expect(resolveSessionlessMcpEnabled(true)).toBe(true);

    vi.stubEnv('METORIAL_ENV', 'staging');
    expect(resolveSessionlessMcpEnabled(false)).toBe(false);
  });
});
