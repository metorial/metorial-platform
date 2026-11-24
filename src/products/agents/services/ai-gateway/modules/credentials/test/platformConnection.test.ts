import { describe, expect, it } from 'vitest';
import {
  platformConnection,
  resolvePlatformConnection,
  validatePlatformConnections
} from '../src/lib/definitions/platformConnection';

let anthropic = (apiKey?: string) =>
  platformConnection({
    slug: 'anthropic',
    provider: 'anthropic',
    name: 'Anthropic',
    credentials: { apiKey }
  });

let azure = (resourceName?: string) =>
  platformConnection({
    slug: 'azure',
    provider: 'azure',
    name: 'Azure',
    credentials: { apiKey: 'az-key-1234' },
    config: { resourceName }
  });

describe('platformConnection', () => {
  it('rejects providers the gateway does not support', () => {
    expect(() =>
      platformConnection({ slug: 'acme', provider: 'acme', name: 'Acme', credentials: {} })
    ).toThrow(/not supported/);
  });

  it('only enables features the provider supports', () => {
    let feature = (provider: string) =>
      platformConnection({
        slug: provider,
        provider,
        name: provider,
        credentials: {},
        features: { zdr: true }
      });

    expect(feature('anthropic').features).toEqual({ zdr: true });
    expect(anthropic().features).toEqual({});
    expect(() => feature('deepseek')).toThrow(/zero data retention/i);
  });

  it('rejects slugs that are not kebab-case', () => {
    expect(() =>
      platformConnection({
        slug: 'Anthropic Direct',
        provider: 'anthropic',
        name: 'Anthropic',
        credentials: {}
      })
    ).toThrow(/kebab-case/);
  });

  it('rejects duplicate slugs', () => {
    expect(() => validatePlatformConnections([anthropic('a'), anthropic('b')])).toThrow(
      /defined twice/
    );
  });
});

describe('resolvePlatformConnection', () => {
  it('resolves credentials and a hint when every env value is set', () => {
    let resolved = resolvePlatformConnection(anthropic('sk-ant-abcdef123456'));

    expect(resolved).toEqual({
      configured: true,
      credentials: { apiKey: 'sk-ant-abcdef123456' },
      config: {},
      credentialHint: '…3456'
    });
  });

  it('is unconfigured while a credential is unset or empty', () => {
    expect(resolvePlatformConnection(anthropic())).toMatchObject({ configured: false });
    expect(resolvePlatformConnection(anthropic(''))).toMatchObject({
      configured: false,
      reason: expect.stringContaining('apiKey')
    });
  });

  it('is unconfigured while a config value is unset', () => {
    expect(resolvePlatformConnection(azure())).toMatchObject({
      configured: false,
      reason: expect.stringContaining('resourceName')
    });
  });

  it('is unconfigured when the provider rejects the config shape', () => {
    expect(resolvePlatformConnection(azure('Not A Resource!'))).toMatchObject({
      configured: false,
      reason: expect.stringContaining('resource name')
    });
  });
});
