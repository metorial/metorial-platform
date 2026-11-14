import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { functionBayNodeBuildToolchain } from './buildToolchain';

describe('functionBayNodeBuildToolchain', () => {
  it('pins every package used by provider builds', () => {
    expect(functionBayNodeBuildToolchain).toEqual({
      ncc: '@vercel/ncc@0.44.1',
      typescript: 'typescript@5.9.3',
      nodeTypes: '@types/node@24.13.3'
    });

    expect(
      Object.values(functionBayNodeBuildToolchain).every(packageSpec =>
        /@[\d.]+$/.test(packageSpec)
      )
    ).toBe(true);
  });

  it('uses a TypeScript release with the compiler API required by ncc', () => {
    expect(ts.version).toBe('5.9.3');
    expect(ts.sys).toBeDefined();
    expect(ts.sys.fileExists).toBeTypeOf('function');
  });
});
