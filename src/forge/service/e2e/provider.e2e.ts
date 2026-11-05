import { describe, expect, it } from 'vitest';
import { env } from '../src/env';
import { forge } from './client';

describe('forge provider', () => {
  it('returns the default provider', async () => {
    let provider = await forge.provider.getDefault({});

    expect(provider).toMatchObject({ name: env.provider.DEFAULT_PROVIDER });
    expect(provider.id).toEqual(expect.any(String));
    expect(provider.identifier).toEqual(expect.any(String));
  });
});
