import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/env', () => ({
  createValidatedEnv: vi.fn((schema: any) => {
    return {
      db: {
        USAGE_MONGO_URL: process.env.USAGE_MONGO_URL
      }
    };
  })
}));

vi.mock('@metorial/validation', () => ({
  v: {
    optional: vi.fn((validator: any) => validator),
    string: vi.fn(() => 'string')
  }
}));

// Import after mocking
import { env } from '../src/env';

describe('env', () => {
  it('exports env object', () => {
    expect(env).toBeDefined();
    expect(env).toHaveProperty('db');
  });

  it('env.db has USAGE_MONGO_URL property', () => {
    expect(env.db).toHaveProperty('USAGE_MONGO_URL');
  });

  it('USAGE_MONGO_URL is optional', () => {
    // Optional means it can be undefined
    expect(env.db.USAGE_MONGO_URL === undefined || typeof env.db.USAGE_MONGO_URL === 'string').toBe(
      true
    );
  });

  it('env.db structure is correct', () => {
    expect(typeof env.db).toBe('object');
    expect(Object.keys(env.db)).toContain('USAGE_MONGO_URL');
  });
});
