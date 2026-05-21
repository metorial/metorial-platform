import { describe, expect, it } from 'vitest';
import { getBuildPlan } from './buildPlan';

describe('getBuildPlan', () => {
  it('skips package build scripts when function-bay.json disables builds', () => {
    expect(
      getBuildPlan(
        { build: false },
        {
          scripts: {
            build: 'npm run should-not-run'
          }
        }
      )
    ).toEqual({ type: 'skip' });
  });

  it('uses explicit Function Bay build scripts before package scripts', () => {
    expect(
      getBuildPlan(
        {
          scripts: {
            build: 'npm run function-bay-build'
          }
        },
        {
          scripts: {
            build: 'npm run package-build'
          }
        }
      )
    ).toEqual({ type: 'script', command: 'npm run function-bay-build' });
  });

  it('falls back to package build scripts when builds are not disabled', () => {
    expect(
      getBuildPlan(null, {
        scripts: {
          build: 'npm run package-build'
        }
      })
    ).toEqual({ type: 'package-script' });
  });
});
