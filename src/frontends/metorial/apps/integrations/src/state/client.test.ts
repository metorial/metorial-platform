import { describe, expect, it } from 'vitest';
import {
  getClientSecretRegion,
  parseIntegrationsApiUrls,
  resolveIntegrationsApiUrl
} from './client';

describe('integrations API routing', () => {
  let apiUrls = {
    us1: 'https://integrations-us1.metorial.com',
    eu1: 'https://integrations-eu1.metorial.com'
  };

  it('extracts the cell from both setup session secret formats', () => {
    expect(getClientSecretRegion('pas_secret_abc123_us1')).toBe('us1');
    expect(getClientSecretRegion('iss_secret_def456_eu1')).toBe('eu1');
  });

  it('routes a client secret through the configured cell allowlist', () => {
    expect(resolveIntegrationsApiUrl('pas_secret_abc123_eu1', apiUrls)).toBe(
      'https://integrations-eu1.metorial.com'
    );
  });

  it('rejects legacy secrets without a cell suffix', () => {
    expect(() => getClientSecretRegion('pas_secret_abc123')).toThrow(
      'does not include a region'
    );
  });

  it('rejects cells that are not in the configured allowlist', () => {
    expect(() => resolveIntegrationsApiUrl('iss_secret_abc123_ap1', apiUrls)).toThrow(
      'No integrations API configured for region ap1'
    );
  });

  it('parses and normalizes the API URL environment map', () => {
    expect(
      parseIntegrationsApiUrls(
        '{"us1":"https://integrations-us1.metorial.com/","dev":"http://localhost:4316"}'
      )
    ).toEqual({
      us1: 'https://integrations-us1.metorial.com',
      dev: 'http://localhost:4316'
    });
  });
});
