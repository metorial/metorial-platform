import { describe, expect, it } from 'vitest';
import { env } from '../src/env';

describe('env', () => {
  it('should have env object defined', () => {
    expect(env).toBeDefined();
  });

  it('should have db property', () => {
    expect(env.db).toBeDefined();
  });

  it('should have USAGE_MONGO_URL property in db', () => {
    // This property can be undefined or a string
    expect(env.db).toHaveProperty('USAGE_MONGO_URL');
  });

  it('should have valid USAGE_MONGO_URL type', () => {
    const url = env.db.USAGE_MONGO_URL;

    // Should be either undefined or a string
    expect(url === undefined || typeof url === 'string').toBe(true);
  });
});
