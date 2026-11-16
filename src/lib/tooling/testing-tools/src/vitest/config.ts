import { mergeConfig, type ViteUserConfig } from 'vitest/config';
import { isCi } from './ci';

export const baseVitestConfig: ViteUserConfig = {
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    sequence: {
      concurrent: false
    },
    fileParallelism: false,
    maxConcurrency: 1,
    allowOnly: !isCi()
  }
};

export const createVitestConfig = (overrides: ViteUserConfig = {}): ViteUserConfig =>
  mergeConfig(baseVitestConfig, overrides);

export const withAliases = (
  config: ViteUserConfig,
  aliases: Record<string, string>
): ViteUserConfig => mergeConfig(config, { resolve: { alias: aliases } });
