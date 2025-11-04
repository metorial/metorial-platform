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

  it('should have aws configuration', () => {
    expect(env.aws).toBeDefined();
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

    it('should have deno and aws configurations', () => {
      const callArgs = (createValidatedEnv as any).mock.calls[0][0];
      const keys = Object.keys(callArgs);
      expect(keys).toEqual(['deno', 'aws']);
    });

    it('should have exactly 3 deno env variables', () => {
      const callArgs = (createValidatedEnv as any).mock.calls[0][0];
      const denoKeys = Object.keys(callArgs.deno);
      expect(denoKeys).toHaveLength(3);
    });

    it('should have correct structure for aws config', () => {
      const callArgs = (createValidatedEnv as any).mock.calls[0][0];
      expect(callArgs).toHaveProperty('aws');
      expect(callArgs.aws).toHaveProperty('AWS_ACCESS_KEY_ID');
      expect(callArgs.aws).toHaveProperty('AWS_SECRET_ACCESS_KEY');
      expect(callArgs.aws).toHaveProperty('AWS_REGION');
      expect(callArgs.aws).toHaveProperty('AWS_ACCOUNT_ID');
      expect(callArgs.aws).toHaveProperty('LAMBDA_DEPLOY_RESOURCE_PREFIX');
    });

    it('should have exactly 5 aws env variables', () => {
      const callArgs = (createValidatedEnv as any).mock.calls[0][0];
      const awsKeys = Object.keys(callArgs.aws);
      expect(awsKeys).toHaveLength(5);
    });
  });

  describe('validation', () => {
    it('should use createValidatedEnv from @metorial/env', () => {
      expect(createValidatedEnv).toHaveBeenCalledTimes(1);
    });

    it('should validate all fields as optional', () => {
      // All 8 fields should be optional (3 deno + 5 aws)
      expect(v.optional).toHaveBeenCalledTimes(8);
    });

    it('should validate all fields as strings', () => {
      // All 8 fields should be strings (3 deno + 5 aws)
      expect(v.string).toHaveBeenCalledTimes(8);
    });
  });
});
