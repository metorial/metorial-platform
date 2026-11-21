import { describe, expect, it } from 'vitest';
import { npmRegistryEnv } from './npmRegistry';

describe('npmRegistryEnv', () => {
  it('points npm and yarn at the configured registry', () => {
    expect(npmRegistryEnv('https://npm.example.com/repository/npm/')).toEqual({
      NPM_CONFIG_REGISTRY: 'https://npm.example.com/repository/npm/',
      YARN_REGISTRY: 'https://npm.example.com/repository/npm/'
    });
  });

  it('leaves the package manager defaults without a registry', () => {
    expect(npmRegistryEnv(undefined)).toEqual({});
  });
});
