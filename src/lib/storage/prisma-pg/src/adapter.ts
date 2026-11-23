import { PrismaPg } from '@prisma/adapter-pg';
import type { PoolConfig } from 'pg';
import { withPoolDefaults } from './pool';
import type { PrismaPgAdapterOptions } from './reporting';
import { RetryingPool } from './retryingPool';

export let createPrismaPgAdapter = (
  poolConfig: PoolConfig,
  options: PrismaPgAdapterOptions
): PrismaPg => {
  let config = withPoolDefaults(poolConfig, options);

  if (options.environment !== 'development' && options.environment !== 'staging') {
    return new PrismaPg(config);
  }

  return new PrismaPg(new RetryingPool(config, options), { disposeExternalPool: true });
};
