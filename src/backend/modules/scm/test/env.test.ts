// @ts-nocheck - Test file with dynamic imports
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set up environment variables before importing
process.env.SCM_GITHUB_CLIENT_ID = 'test-client-id';
process.env.SCM_GITHUB_CLIENT_SECRET = 'test-client-secret';

describe('Environment Configuration', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should have required GitHub environment variables', async () => {
    const { env } = await import('../src/env');

    expect(env).toBeDefined();
  });

  it('should export env object with gh property', async () => {
    const { env } = await import('../src/env');

    expect(env).toBeDefined();
    expect(env.gh).toBeDefined();
    expect(env.gh.SCM_GITHUB_CLIENT_ID).toBeDefined();
    expect(env.gh.SCM_GITHUB_CLIENT_SECRET).toBeDefined();
  });
});
