import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('env', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('createValidatedEnv', () => {
    it('should export env object', async () => {
      const { env } = await import('../src/env');
      expect(env).toBeDefined();
    });

    it('should have ticket configuration', async () => {
      const { env } = await import('../src/env');
      expect(env.ticket).toBeDefined();
    });

    it('should have PROVIDER_OAUTH_TICKET_SECRET field', async () => {
      const { env } = await import('../src/env');
      expect(env.ticket).toHaveProperty('PROVIDER_OAUTH_TICKET_SECRET');
    });

    it('should have PROVIDER_OAUTH_URL field', async () => {
      const { env } = await import('../src/env');
      expect(env.ticket).toHaveProperty('PROVIDER_OAUTH_URL');
    });

    it('should validate PROVIDER_OAUTH_TICKET_SECRET as string', async () => {
      const { env } = await import('../src/env');
      expect(typeof env.ticket.PROVIDER_OAUTH_TICKET_SECRET).toBe('string');
    });

    it('should validate PROVIDER_OAUTH_URL as string', async () => {
      const { env } = await import('../src/env');
      expect(typeof env.ticket.PROVIDER_OAUTH_URL).toBe('string');
    });
  });

  describe('edge cases', () => {
    it('should handle env reassignment', async () => {
      let { env } = await import('../src/env');
      const originalEnv = env;

      // The env is exported with let, so it can be reassigned
      expect(() => {
        env = originalEnv;
      }).not.toThrow();
    });

    it('should maintain consistent structure across multiple imports', async () => {
      const { env: env1 } = await import('../src/env');
      const { env: env2 } = await import('../src/env');

      expect(env1).toBe(env2);
      expect(env1.ticket).toBe(env2.ticket);
    });
  });
});
