import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_: string, factory: () => unknown) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: { create: vi.fn() }
}));

vi.mock('@lowerdeck/slugify', () => ({
  createSlugGenerator: vi.fn(() => vi.fn())
}));

let config = {
  env: 'production' as 'production' | 'development',
  urls: { portalsUrl: 'http://localhost:4300' }
};

vi.hoisted(() => {
  process.env.PORTAL_HOST_TEMPLATE = 'https://portals.metorial.test/{portalId}';
  process.env.PORTAL_REDIRECT_DOMAINS = '';
});

vi.mock('@metorial/config', () => ({
  getConfig: () => config
}));

vi.mock('@metorial/db', () => ({
  db: {},
  ID: { generateId: vi.fn() },
  withTransaction: vi.fn()
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));

vi.mock('@metorial/module-organization', () => ({
  namespaceService: {
    getNamespacePropertiesByPortalOid: vi.fn()
  }
}));

vi.mock('@metorial/module-consumer-core', () => ({
  consumerSurfaceService: {}
}));

import { namespaceService } from '@metorial/module-organization';
import { portalService } from '../src/services/portal';

let portal = { oid: 1n, slug: 'acme' };

let namespaceProperty = (d: { value: string; compartment: string; purposes: string[] }) => ({
  namespace: {
    value: d.value,
    purposes: d.purposes,
    compartment: { value: d.compartment }
  }
});

let mockNamespaces = (properties: unknown[]) =>
  vi
    .mocked(namespaceService.getNamespacePropertiesByPortalOid)
    .mockResolvedValue(new Map([[portal.oid, properties as any]]));

describe('portalService.getPrimaryPortalUrls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    config.env = 'production';
    config.urls.portalsUrl = 'http://localhost:4300';
  });

  it('serves a portal-specific namespace at the root', async () => {
    mockNamespaces([
      namespaceProperty({
        value: 'acme-portal',
        compartment: 'portals.metorial.com',
        purposes: ['metorial_portal', 'metorial_portal_single']
      })
    ]);

    let urls = await portalService.getPrimaryPortalUrls({ portals: [portal] });

    expect(urls.get(portal.oid)).toBe('https://acme-portal.portals.metorial.com');
  });

  it('disambiguates a shared namespace with the portal slug', async () => {
    mockNamespaces([
      namespaceProperty({
        value: 'acme',
        compartment: 'portals.metorial.com',
        purposes: ['metorial_platform', 'metorial_portal']
      })
    ]);

    let urls = await portalService.getPrimaryPortalUrls({ portals: [portal] });

    expect(urls.get(portal.oid)).toBe('https://acme.portals.metorial.com/p/acme');
  });

  it('picks the highest-priority shared namespace over a lower-priority one', async () => {
    // getNamespacePropertiesByPortalOid already returns these ordered by compartment priority.
    mockNamespaces([
      namespaceProperty({
        value: 'acme',
        compartment: 'high.metorial.com',
        purposes: ['metorial_portal']
      }),
      namespaceProperty({
        value: 'acme',
        compartment: 'low.metorial.com',
        purposes: ['metorial_portal']
      })
    ]);

    let urls = await portalService.getPrimaryPortalUrls({ portals: [portal] });

    expect(urls.get(portal.oid)).toBe('https://acme.high.metorial.com/p/acme');
  });

  it('puts portal-specific namespaces after shared ones, even when listed first', async () => {
    mockNamespaces([
      namespaceProperty({
        value: 'acme-portal',
        compartment: 'high.metorial.com',
        purposes: ['metorial_portal_single']
      }),
      namespaceProperty({
        value: 'acme',
        compartment: 'low.metorial.com',
        purposes: ['metorial_portal']
      })
    ]);

    expect(
      portalService.getPortalUrls({
        portal,
        namespaces: [
          namespaceProperty({
            value: 'acme-portal',
            compartment: 'high.metorial.com',
            purposes: ['metorial_portal_single']
          }),
          namespaceProperty({
            value: 'acme',
            compartment: 'low.metorial.com',
            purposes: ['metorial_portal']
          })
        ] as any
      })
    ).toEqual([
      { type: 'namespace', url: 'https://acme.low.metorial.com/p/acme' },
      { type: 'namespace', url: 'https://acme-portal.high.metorial.com' }
    ]);

    let urls = await portalService.getPrimaryPortalUrls({ portals: [portal] });
    expect(urls.get(portal.oid)).toBe('https://acme.low.metorial.com/p/acme');
  });

  it('falls back to the configured host when the portal has no namespace', async () => {
    mockNamespaces([]);

    let urls = await portalService.getPrimaryPortalUrls({ portals: [portal] });

    expect(urls.get(portal.oid)).toBe('https://portals.metorial.test/acme');
  });

  it('resolves every portal in one namespace lookup', async () => {
    let other = { oid: 2n, slug: 'globex' };
    vi.mocked(namespaceService.getNamespacePropertiesByPortalOid).mockResolvedValue(
      new Map([
        [
          portal.oid,
          [
            namespaceProperty({
              value: 'acme-portal',
              compartment: 'portals.metorial.com',
              purposes: ['metorial_portal_single']
            })
          ]
        ]
      ]) as any
    );

    let urls = await portalService.getPrimaryPortalUrls({ portals: [portal, other] });

    expect(namespaceService.getNamespacePropertiesByPortalOid).toHaveBeenCalledTimes(1);
    expect(urls.get(portal.oid)).toBe('https://acme-portal.portals.metorial.com');
    expect(urls.get(other.oid)).toBe('https://portals.metorial.test/globex');
  });

  describe('getPortalUrlForOrigin', () => {
    let namespaces = [
      namespaceProperty({
        value: 'acme',
        compartment: 'portals.metorial.com',
        purposes: ['metorial_portal']
      }),
      namespaceProperty({
        value: 'acme-portal',
        compartment: 'portals.metorial.com',
        purposes: ['metorial_portal_single']
      })
    ];

    it('keeps the request on the host it came from', async () => {
      mockNamespaces(namespaces);

      expect(
        await portalService.getPortalUrlForOrigin({
          portal,
          origin: 'https://acme-portal.portals.metorial.com'
        })
      ).toBe('https://acme-portal.portals.metorial.com');
    });

    it('falls back to the primary URL for an unknown origin', async () => {
      mockNamespaces(namespaces);

      expect(
        await portalService.getPortalUrlForOrigin({
          portal,
          origin: 'https://somewhere.else.com'
        })
      ).toBe('https://acme.portals.metorial.com/p/acme');
    });

    it('falls back to the primary URL when there is no origin', async () => {
      mockNamespaces(namespaces);

      expect(await portalService.getPortalUrlForOrigin({ portal })).toBe(
        'https://acme.portals.metorial.com/p/acme'
      );
    });

    it('falls back to the configured host when the portal has no namespace', async () => {
      mockNamespaces([]);

      expect(
        await portalService.getPortalUrlForOrigin({
          portal,
          origin: 'https://acme.portals.metorial.com'
        })
      ).toBe('https://portals.metorial.test/acme');
    });
  });

  describe('in development', () => {
    beforeEach(() => {
      config.env = 'development';
    });

    it('prefers the locally served portal over any namespace', async () => {
      mockNamespaces([
        namespaceProperty({
          value: 'acme-portal',
          compartment: 'portals.metorial.com',
          purposes: ['metorial_portal_single']
        })
      ]);

      let urls = await portalService.getPrimaryPortalUrls({ portals: [portal] });

      expect(urls.get(portal.oid)).toBe('http://localhost:4300/p/acme');
    });

    it('keeps the namespaces available behind the local URL', async () => {
      mockNamespaces([
        namespaceProperty({
          value: 'acme-portal',
          compartment: 'portals.metorial.com',
          purposes: ['metorial_portal_single']
        })
      ]);

      expect(
        portalService.getPortalUrls({
          portal,
          namespaces: [
            namespaceProperty({
              value: 'acme-portal',
              compartment: 'portals.metorial.com',
              purposes: ['metorial_portal_single']
            })
          ] as any
        })
      ).toEqual([
        { type: 'default', url: 'http://localhost:4300/p/acme' },
        { type: 'namespace', url: 'https://acme-portal.portals.metorial.com' }
      ]);
    });

    it('is the only URL when the portal has no namespace', async () => {
      mockNamespaces([]);

      let urls = await portalService.getPrimaryPortalUrls({ portals: [portal] });

      expect(urls.get(portal.oid)).toBe('http://localhost:4300/p/acme');
    });

    it('does not double up the slash on a trailing-slash portals URL', async () => {
      config.urls.portalsUrl = 'http://localhost:4300/';
      mockNamespaces([]);

      let urls = await portalService.getPrimaryPortalUrls({ portals: [portal] });

      expect(urls.get(portal.oid)).toBe('http://localhost:4300/p/acme');
    });
  });
});
