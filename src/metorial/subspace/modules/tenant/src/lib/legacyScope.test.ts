import { describe, expect, it } from 'vitest';

import { isCanonicalEnvironmentIdentifier, isCanonicalProjectIdentifier } from './legacyScope';

describe('identifier parsing', () => {
  it('separates canonical identifiers from the legacy ones they resemble', () => {
    expect(isCanonicalProjectIdentifier('mte-pro-2')).toBe(true);
    expect(isCanonicalProjectIdentifier('mteo-org_1')).toBe(false);
    expect(isCanonicalProjectIdentifier(null)).toBe(false);

    expect(isCanonicalEnvironmentIdentifier('mte-ins-3')).toBe(true);
    // The legacy per-instance tenant uses an underscore where the canonical one uses a dash.
    expect(isCanonicalEnvironmentIdentifier('mte-ins_0mlz')).toBe(false);
    expect(isCanonicalEnvironmentIdentifier('mtei-ins_0mlz')).toBe(false);
  });
});
