import { describe, expect, it } from 'vitest';
import { integrationsRedirectUrl } from './urls';

describe('integrationsRedirectUrl', () => {
  it('moves a page URL to the UI origin and preserves its query', () => {
    expect(
      integrationsRedirectUrl(
        'https://integrations.example.com/',
        '/setup-session/setup_123',
        'https://integrations.example.com/setup-session/setup_123?client_secret=secret&mode=embed'
      )
    ).toBe(
      'https://integrations.example.com/setup-session/setup_123?client_secret=secret&mode=embed'
    );
  });
});
