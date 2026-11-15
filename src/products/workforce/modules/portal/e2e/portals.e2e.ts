import { expectServiceError, firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { portalService } from '../src';
import { createPortal, dnsLabel } from './_fixtures';

let listPortalIds = async (fixture: OrganizationFixture, search?: string) =>
  (await firstPage(portalService.listPortals({ instance: fixture.instance, search }))).map(
    portal => portal.id
  );

describe('module-portal portals', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('derives unique DNS-safe slugs from portal names', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let suffix = uniqueId('x').toLowerCase();

    let accented = await createPortal(fixture, { name: `Ünïcode & Spaces!! ${suffix}` });
    expect(accented.slug).toMatch(dnsLabel);

    let long = await createPortal(fixture, {
      name: `${'Long Portal Name '.repeat(8)}${suffix}`
    });
    expect(long.slug).toMatch(dnsLabel);
    expect(long.slug.length).toBeLessThanOrEqual(63);

    let symbols = await createPortal(fixture, { name: '!!! ???' });
    expect(symbols.slug).toMatch(dnsLabel);

    let name = uniqueId('Same Name');
    let first = await createPortal(fixture, { name });
    let second = await createPortal(fixture, { name });
    expect(first.slug).toMatch(dnsLabel);
    expect(second.slug).toMatch(dnsLabel);
    expect(second.slug).not.toBe(first.slug);
  });

  it('keeps the slug and host stable across renames', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let portal = await createPortal(fixture);
    let { host } = portalService.getPortalHost({ portal });

    expect(portalService.parsePortalIdFromHost({ url: host })?.portalId).toBe(portal.slug);
    expect(
      portalService.parsePortalIdFromHost({ url: 'https://unrelated.example.com/' })
    ).toBeNull();

    let name = uniqueId('Renamed Portal');
    let renamed = await portalService.updatePortal({
      portal,
      auditScope: fixture.auditScope,
      input: { name, description: 'Searchable description' }
    });
    expect(renamed.slug).toBe(portal.slug);
    expect(renamed.surface.name).toBe(name);
    expect(portalService.getPortalHost({ portal: renamed }).host).toBe(host);

    let bySlug = await portalService.getPortalById({
      instance: fixture.instance,
      portalId: portal.slug
    });
    expect(bySlug).toMatchObject({ id: portal.id, name });
    expect(await listPortalIds(fixture, name)).toEqual([portal.id]);
  });

  it('stores redirect filters only when they differ from the defaults', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let defaults = [
      { url: 'http://localhost:*/*' },
      { url: 'http://*.localhost:*/*' },
      { url: 'https://*/*' },
      { url: '*://*' }
    ];

    let portal = await createPortal(fixture, { allowedRedirectUrlFilters: defaults });
    expect(portal.allowedRedirectUrlFilters).toBeNull();

    let custom = [{ url: 'https://app.example.com/callback' }];
    let updated = await portalService.updatePortal({
      portal,
      auditScope: fixture.auditScope,
      input: { allowedRedirectUrlFilters: custom }
    });
    expect(updated.allowedRedirectUrlFilters).toEqual(custom);

    let untouched = await portalService.updatePortal({
      portal: updated,
      auditScope: fixture.auditScope,
      input: { description: 'Filters omitted' }
    });
    expect(untouched.allowedRedirectUrlFilters).toEqual(custom);

    let reset = await portalService.updatePortal({
      portal: untouched,
      auditScope: fixture.auditScope,
      input: { allowedRedirectUrlFilters: defaults }
    });
    expect(reset.allowedRedirectUrlFilters).toBeNull();
  });

  it('rejects invalid redirect filters without partial writes', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('Invalid Filters Portal');

    for (let url of ['ftp://files.example.com/*', 'not a url']) {
      await expectServiceError(
        createPortal(fixture, { name, allowedRedirectUrlFilters: [{ url }] }),
        'bad_request'
      );
    }
    expect(await db.portal.count({ where: { name } })).toBe(0);
    expect(await db.consumerSurface.count({ where: { name } })).toBe(0);

    let portal = await createPortal(fixture);
    await expectServiceError(
      portalService.updatePortal({
        portal,
        auditScope: fixture.auditScope,
        input: {
          name: uniqueId('Should Not Apply'),
          sessionExpiryTimeInSeconds: 60,
          allowedRedirectUrlFilters: [{ url: 'ftp://files.example.com/*' }]
        }
      }),
      'bad_request'
    );

    let row = await db.portal.findUniqueOrThrow({ where: { oid: portal.oid } });
    expect(row.name).toBe(portal.name);
    let surface = await db.consumerSurface.findUniqueOrThrow({
      where: { oid: portal.surfaceOid }
    });
    expect(surface).toMatchObject({
      name: portal.surface.name,
      sessionExpiryTimeInSeconds: portal.surface.sessionExpiryTimeInSeconds
    });
  });

  it('refuses changes to archived portals and hides them publicly', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let portal = await createPortal(fixture);
    expect((await portalService.getPortalPublic({ portalId: portal.slug })).id).toBe(
      portal.id
    );

    let archived = await portalService.archivePortal({
      portal,
      auditScope: fixture.auditScope
    });

    await expectServiceError(
      portalService.archivePortal({ portal: archived, auditScope: fixture.auditScope }),
      'precondition_failed'
    );
    await expectServiceError(
      portalService.updatePortal({
        portal: archived,
        auditScope: fixture.auditScope,
        input: { name: 'Too late' }
      }),
      'precondition_failed'
    );

    await expectServiceError(
      portalService.getPortalPublic({ portalId: portal.id }),
      'not_found'
    );
    await expectServiceError(
      portalService.getPortalPublic({ portalId: portal.slug }),
      'not_found'
    );
    expect(await listPortalIds(fixture, portal.slug)).toEqual([]);

    let fetched = await portalService.getPortalById({
      instance: fixture.instance,
      portalId: portal.id
    });
    expect(fetched).toMatchObject({ status: 'archived', name: portal.name });
  });

  it('only resolves public portals under a matching namespace', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let portal = await createPortal(fixture);

    await expectServiceError(
      portalService.getPortalPublic({
        portalId: portal.slug,
        namespace: { value: uniqueId('ns'), compartmentValue: uniqueId('compartment') }
      }),
      'not_found'
    );
    await expectServiceError(
      portalService.getPortalPublic({ portalId: uniqueId('missing-portal') }),
      'not_found'
    );
  });

  it('keeps portals isolated between organizations', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let portal = await createPortal(fixture);

    for (let portalId of [portal.id, portal.slug]) {
      await expectServiceError(
        portalService.getPortalById({ instance: other.instance, portalId }),
        'not_found'
      );
    }
    expect(await listPortalIds(other, portal.slug)).toEqual([]);
    expect(await listPortalIds(other)).not.toContain(portal.id);
  });
});
