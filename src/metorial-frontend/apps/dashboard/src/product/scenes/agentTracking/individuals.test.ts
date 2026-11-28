import { describe, expect, it } from 'vitest';
import { individualsVisibility } from './individuals';

let ready = {
  enabled: true,
  scopes: { loaded: true, hasScope: true },
  settings: { loaded: true, failed: false, hideIndividuals: false }
};

describe('individualsVisibility', () => {
  it('shows individuals with agent tracking, the read scope and individuals not hidden', () => {
    expect(individualsVisibility(ready)).toBe('visible');
  });

  it('is hidden when the organization hides individuals', () => {
    expect(
      individualsVisibility({
        ...ready,
        settings: { ...ready.settings, hideIndividuals: true }
      })
    ).toBe('hidden');
  });

  it('waits for the scopes, then the settings, once the flag is on', () => {
    expect(
      individualsVisibility({ ...ready, scopes: { loaded: false, hasScope: false } })
    ).toBe('pending');
    expect(
      individualsVisibility({ ...ready, settings: { ...ready.settings, loaded: false } })
    ).toBe('pending');
  });

  it('is unavailable while the flags are not loaded, so nothing waits on them', () => {
    expect(
      individualsVisibility({
        enabled: false,
        scopes: { loaded: false, hasScope: false },
        settings: { loaded: false, failed: false, hideIndividuals: false }
      })
    ).toBe('unavailable');
  });

  it('is unavailable without the flag or the scope, or when the settings fail', () => {
    expect(
      individualsVisibility({
        ...ready,
        enabled: false,
        scopes: { loaded: false, hasScope: false }
      })
    ).toBe('unavailable');
    expect(
      individualsVisibility({ ...ready, scopes: { loaded: true, hasScope: false } })
    ).toBe('unavailable');
    expect(
      individualsVisibility({
        ...ready,
        settings: { loaded: false, failed: true, hideIndividuals: false }
      })
    ).toBe('unavailable');
  });
});
