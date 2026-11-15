import { describe, expect, it } from 'vitest';
import { isIntegrationsCorsOriginAllowed } from './cors';

let defaults = {
  integrationsUiUrl: 'https://integrations.example.com',
  isDevelopment: false
};

describe('isIntegrationsCorsOriginAllowed', () => {
  it('allows only the configured UI origin by default', () => {
    expect(
      isIntegrationsCorsOriginAllowed({
        ...defaults,
        origin: 'https://integrations.example.com'
      })
    ).toBe(true);
    expect(
      isIntegrationsCorsOriginAllowed({
        ...defaults,
        origin: 'https://attacker.example.com'
      })
    ).toBe(false);
  });

  it('allows configured and local development origins', () => {
    expect(
      isIntegrationsCorsOriginAllowed({
        ...defaults,
        origin: 'https://embed.example.com',
        corsDomains: 'https://embed.example.com'
      })
    ).toBe(true);
    expect(
      isIntegrationsCorsOriginAllowed({
        ...defaults,
        origin: 'http://localhost:5173',
        isDevelopment: true
      })
    ).toBe(true);
  });
});
