import { describe, expect, it } from 'vitest';
import { mapProviderConfigPatchInput } from './providerConfigPatch';

describe('provider config controller patch DTO', () => {
  it('forwards set/remove and compare generation without replacement semantics', () => {
    expect(
      mapProviderConfigPatchInput({
        configPatch: { set: { endpoint: 'next' }, remove: ['secret'] },
        expectedConfigGeneration: 4
      })
    ).toEqual({
      configPatch: { set: { endpoint: 'next' }, remove: ['secret'] },
      expectedConfigGeneration: 4
    });
  });

  it('preserves omission', () => {
    expect(mapProviderConfigPatchInput({})).toEqual({
      configPatch: undefined,
      expectedConfigGeneration: undefined
    });
  });
});
