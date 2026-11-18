import { beforeEach, describe, expect, it, vi } from 'vitest';

let state = vi.hoisted(() => ({ edition: 'on-prem', env: 'production' }));

vi.mock('@metorial/editions', () => ({
  checkEdition: (...editions: string[]) => editions.includes(state.edition)
}));

vi.mock('@metorial/config', () => ({
  getConfig: () => ({
    env: state.env,
    urls: {
      portalsUrl: 'http://gateway.localhost:8080',
      apiUrl: 'http://gateway.localhost:8080'
    }
  })
}));

vi.mock('@metorial/db', () => ({ db: {} }));

vi.mock('@metorial/module-organization', () => ({ namespaceService: {} }));

vi.mock('./env', () => ({
  env: { portal: { PORTAL_HOST_TEMPLATE: 'http://gateway.localhost:8080/p/{portalId}' } }
}));

import { buildPortalPageUrl, getPortalConnectUrl, getPortalUrls } from './urls';

let portal = { slug: 'test3' };

let namespaces = [
  {
    namespace: {
      value: 'test3-portal',
      compartment: { value: 'gateway.localhost' },
      purposes: ['metorial_portal_single']
    }
  }
] as any;

beforeEach(() => {
  state.edition = 'on-prem';
  state.env = 'production';
});

describe('portal URLs', () => {
  it.each(['production', 'development'])('uses only the on-prem gateway in %s', env => {
    state.env = env;

    expect(getPortalUrls({ portal, namespaces })).toEqual([
      { type: 'default', url: 'http://gateway.localhost:8080/p/test3' }
    ]);
    expect(getPortalConnectUrl({ portal, namespaces })).toBe(
      'http://gateway.localhost:8080/connect/portal/test3'
    );
  });

  it('uses the gateway for on-prem portals without namespaces', () => {
    expect(getPortalUrls({ portal, namespaces: [] })).toEqual([
      { type: 'default', url: 'http://gateway.localhost:8080/p/test3' }
    ]);
  });

  it('preserves dedicated portal namespaces in cloud', () => {
    state.edition = 'cloud';

    expect(getPortalUrls({ portal, namespaces })).toEqual([
      { type: 'namespace', url: 'https://test3-portal.gateway.localhost' }
    ]);
    expect(getPortalConnectUrl({ portal, namespaces })).toBe(
      'https://test3-portal.gateway.localhost/connect/portal/test3'
    );
  });
});

describe('portal page URLs', () => {
  it.each([
    [
      'a shared host portal',
      'https://the.metorial.com/p/metorial-internal',
      'https://the.metorial.com/p/metorial-internal/skill/skl_1'
    ],
    [
      'a single portal host',
      'https://test3-portal.metorial.app',
      'https://test3-portal.metorial.app/skill/skl_1'
    ],
    [
      'a base with a trailing slash',
      'https://the.metorial.com/p/metorial-internal/',
      'https://the.metorial.com/p/metorial-internal/skill/skl_1'
    ],
    [
      'a base with a query and hash',
      'https://the.metorial.com/p/metorial-internal?tab=skills#top',
      'https://the.metorial.com/p/metorial-internal/skill/skl_1'
    ]
  ])('builds page URLs for %s', (_name, portalUrl, expected) => {
    expect(buildPortalPageUrl({ portalUrl, path: 'skill/skl_1' })).toBe(expected);
  });
});
