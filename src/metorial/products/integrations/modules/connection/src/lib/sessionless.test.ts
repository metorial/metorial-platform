import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSessionlessMcpEnabled } from './sessionless';

describe('isSessionlessMcpEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    {
      configured: { sessionlessMcpEnabled: null },
      environment: 'production',
      expected: false
    },
    {
      configured: { sessionlessMcpEnabled: null },
      environment: 'development',
      expected: true
    },
    { configured: {}, environment: 'production', expected: false },
    { configured: {}, environment: 'development', expected: true },
    {
      configured: { sessionlessMcpEnabled: false },
      environment: 'development',
      expected: false
    },
    { configured: { sessionlessMcpEnabled: true }, environment: 'production', expected: true }
  ])(
    'resolves $configured to $expected in $environment',
    ({ configured, environment, expected }) => {
      vi.stubEnv('METORIAL_ENV', environment);

      expect(isSessionlessMcpEnabled(configured)).toBe(expected);
    }
  );
});
