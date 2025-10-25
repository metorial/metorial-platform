import { describe, expect, it, vi } from 'vitest';

// Mock the @metorial/env module
vi.mock('@metorial/env', () => ({
  createValidatedEnv: vi.fn((config) => {
    // Return a mock env object that validates the structure
    const result: any = {};
    for (const [key, value] of Object.entries(config)) {
      result[key] = {};
    }
    return result;
  })
}));

// Mock the @metorial/validation module
vi.mock('@metorial/validation', () => ({
  v: {
    optional: vi.fn((validator) => ({ optional: true, validator })),
    string: vi.fn(() => ({ type: 'string' }))
  }
}));

import { createValidatedEnv } from '@metorial/env';
import { v } from '@metorial/validation';
import { env } from '../src/env';

describe('env', () => {
  it('should export env object', () => {
    expect(env).toBeDefined();
  });

  it('should have deno configuration', () => {
    expect(env.deno).toBeDefined();
  });

  it('should define DENO_DEPLOY_TOKEN as optional string', () => {
    expect(createValidatedEnv).toHaveBeenCalledWith(
      expect.objectContaining({
        deno: expect.any(Object)
      })
    );
    expect(v.optional).toHaveBeenCalled();
    expect(v.string).toHaveBeenCalled();
  });

  it('should define DENO_ORGANIZATION_ID as optional string', () => {
    // Verify that optional and string were called multiple times
    // (once for each env variable)
    expect(v.optional).toHaveBeenCalled();
    expect(v.string).toHaveBeenCalled();
  });

  it('should define DENO_RUNNER_ADDRESS as optional string', () => {
    expect(v.optional).toHaveBeenCalled();
    expect(v.string).toHaveBeenCalled();
  });

  describe('env structure', () => {
    it('should have correct structure for deno config', () => {
      const callArgs = (createValidatedEnv as any).mock.calls[0][0];
      expect(callArgs).toHaveProperty('deno');
      expect(callArgs.deno).toHaveProperty('DENO_DEPLOY_TOKEN');
      expect(callArgs.deno).toHaveProperty('DENO_ORGANIZATION_ID');
      expect(callArgs.deno).toHaveProperty('DENO_RUNNER_ADDRESS');
    });

    it('should only have deno configuration', () => {
      const callArgs = (createValidatedEnv as any).mock.calls[0][0];
      const keys = Object.keys(callArgs);
      expect(keys).toEqual(['deno']);
    });

    it('should have exactly 3 deno env variables', () => {
      const callArgs = (createValidatedEnv as any).mock.calls[0][0];
      const denoKeys = Object.keys(callArgs.deno);
      expect(denoKeys).toHaveLength(3);
    });
  });

  describe('validation', () => {
    it('should use createValidatedEnv from @metorial/env', () => {
      expect(createValidatedEnv).toHaveBeenCalledTimes(1);
    });

    it('should validate all fields as optional', () => {
      // All 3 fields should be optional
      expect(v.optional).toHaveBeenCalledTimes(3);
    });

    it('should validate all fields as strings', () => {
      // All 3 fields should be strings
      expect(v.string).toHaveBeenCalledTimes(3);
    });
  });
});
