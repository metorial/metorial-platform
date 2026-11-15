import { configDefaults, defineConfig } from 'vitest/config';

let realData = process.env.MODEL_CATALOG_REAL_DATA === '1';

let livePricing = process.env.MODEL_CATALOG_PRICING_LIVE === '1';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'src/sources/*/**/*.test.ts'],
    exclude: [
      ...configDefaults.exclude,
      ...(realData ? [] : ['test/realData.test.ts']),
      ...(livePricing ? [] : ['test/pricingLive.test.ts'])
    ],
    testTimeout: realData || livePricing ? 600_000 : 30_000
  }
});
