import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as prettier from 'prettier';
import { describe, expect, it } from 'vitest';
import { getOrganizationConfigDeclarations } from '../src/definitions/config';
import { renderOrganizationConfigRegistry } from '../src/definitions/configRegistry';
import '../src/definitions/skillConfigs';

let generatedPath = path.resolve(
  import.meta.dirname,
  '../../../../../metorial-frontend/packages/state/src/config/generated/organizationConfigs.ts'
);

describe('organization config registry', () => {
  it('is in sync with the checked-in frontend types', async () => {
    let expected = await prettier.format(
      renderOrganizationConfigRegistry(getOrganizationConfigDeclarations()),
      { ...(await prettier.resolveConfig(generatedPath)), filepath: generatedPath }
    );

    let actual = await readFile(generatedPath, 'utf-8');

    expect(
      actual,
      'Run `bun run generate:config-types` to regenerate the frontend config types'
    ).toBe(expected);
  });
});
