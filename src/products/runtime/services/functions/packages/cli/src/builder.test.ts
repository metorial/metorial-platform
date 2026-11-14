import { describe, expect, it, vi } from 'vitest';
import { resolvePreinstalledBuilder } from './builder';

let knativeLayer = JSON.stringify({ provider: 'knative' });
let lambdaLayer = JSON.stringify({ provider: 'aws.lambda' });

describe('resolvePreinstalledBuilder', () => {
  it('prefers an explicit builder path', () => {
    expect(
      resolvePreinstalledBuilder({
        env: {
          METORIAL_FUNCTION_BAY_BUILDER_PATH: '/opt/builder/index.cjs',
          METORIAL_FUNCTION_BAY_BUILD_LAYER: lambdaLayer
        }
      })
    ).toBe('/opt/builder/index.cjs');
  });

  it('uses the co-installed builder for knative builds', () => {
    let resolve = vi.fn(() => '/usr/lib/node_modules/@function-bay/nodejs/dist/index.cjs');

    expect(
      resolvePreinstalledBuilder({
        env: { METORIAL_FUNCTION_BAY_BUILD_LAYER: knativeLayer },
        resolve
      })
    ).toBe('/usr/lib/node_modules/@function-bay/nodejs/dist/index.cjs');
    expect(resolve).toHaveBeenCalledWith('@function-bay/nodejs');
  });

  it('falls back to installing when the knative image has no builder', () => {
    expect(
      resolvePreinstalledBuilder({
        env: { METORIAL_FUNCTION_BAY_BUILD_LAYER: knativeLayer },
        resolve: () => {
          throw new Error('not found');
        }
      })
    ).toBeUndefined();
  });

  it('keeps installing the builder for lambda builds', () => {
    let resolve = vi.fn(() => '/somewhere');

    expect(
      resolvePreinstalledBuilder({
        env: { METORIAL_FUNCTION_BAY_BUILD_LAYER: lambdaLayer },
        resolve
      })
    ).toBeUndefined();
    expect(resolve).not.toHaveBeenCalled();
  });
});
