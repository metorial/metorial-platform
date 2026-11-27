import { describe, expect, it } from 'vitest';
import { toAuthMethodCapabilities } from './authMethodCapabilities';

describe('toAuthMethodCapabilities', () => {
  it('keeps a required admin setup', () => {
    expect(
      toAuthMethodCapabilities({ adminSetup: { enabled: true, required: true } })
    ).toEqual({
      adminSetup: { enabled: true, required: true }
    });
  });

  it('omits required when the admin setup is optional', () => {
    expect(
      toAuthMethodCapabilities({ adminSetup: { enabled: true, required: false } })
    ).toEqual({ adminSetup: { enabled: true } });
    expect(toAuthMethodCapabilities({ adminSetup: { enabled: true } })).toEqual({
      adminSetup: { enabled: true }
    });
  });

  it('drops capabilities without an enabled admin setup', () => {
    expect(
      toAuthMethodCapabilities({ adminSetup: { enabled: false, required: true } })
    ).toEqual({});
    expect(toAuthMethodCapabilities({ other: true })).toEqual({});
    expect(toAuthMethodCapabilities(undefined)).toEqual({});
  });
});
