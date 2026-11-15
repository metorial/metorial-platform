import { PrismaPg } from '@prisma/adapter-pg';
import type { PoolConfig } from 'pg';
import { RetryingPool } from './retryingPool';
import type { PrismaPgAdapterOptions } from './reporting';

export type { PrismaPgAdapterOptions } from './reporting';

export let createPrismaPgAdapter = (
  poolConfig: PoolConfig,
  options: PrismaPgAdapterOptions
): PrismaPg => {
  if (options.environment !== 'development' && options.environment !== 'staging') {
    return new PrismaPg(poolConfig);
  }

  return new PrismaPg(new RetryingPool(poolConfig, options), { disposeExternalPool: true });
};
