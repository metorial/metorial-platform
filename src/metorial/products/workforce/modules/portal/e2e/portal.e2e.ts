import { firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { portalService, projectWorkforceConfigurationService } from '../src';

let createPortal = async (fixture: OrganizationFixture, name = uniqueId('Portal')) =>
  await portalService.createPortal({
    organization: fixture.organization,
    instance: fixture.instance,
    context: fixture.context,
    auditScope: fixture.auditScope,
    input: { name, description: 'Created by the e2e suite' }
  });

describe('module-portal', () => {
  let org = useOrganization();

  it('creates a portal backed by a consumer surface and finds it by id, slug and search', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('Portal');

    let portal = await createPortal(fixture, name);
    expect(portal.name).toBe(name);
    expect(portal.status).toBe('active');
    expect(portal.slug).toMatch(/^[a-z0-9-]+$/);
    expect(portal.surface.type).toBe('portal');
    expect(portal.surface.status).toBe('active');
    expect(portal.surface.managedEveryoneGroup?.isDefaultEveryoneGroup).toBe(true);
    expect(portal.surface.publishableApiKey).toBeTruthy();

    let byId = await portalService.getPortalById({
      instance: fixture.instance,
      portalId: portal.id
    });
    expect(byId.id).toBe(portal.id);

    let bySlug = await portalService.getPortalById({
      instance: fixture.instance,
      portalId: portal.slug
    });
    expect(bySlug.id).toBe(portal.id);

    let publicPortal = await portalService.getPortalPublic({ portalId: portal.id });
    expect(publicPortal.id).toBe(portal.id);

    let listed = await firstPage(
      portalService.listPortals({ instance: fixture.instance, search: portal.slug })
    );
    expect(listed.map(item => item.id)).toContain(portal.id);

    expect(portalService.getPortalHost({ portal }).host).toContain(portal.slug);
  });

  it('updates a portal and its consumer surface', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let portal = await createPortal(fixture);

    let name = uniqueId('Renamed Portal');
    let updated = await portalService.updatePortal({
      portal,
      auditScope: fixture.auditScope,
      input: {
        name,
        description: 'Updated by the e2e suite',
        sessionExpiryTimeInSeconds: 3600,
        allowedRedirectUrlFilters: [{ url: 'https://example.com/*' }]
      }
    });
    expect(updated.name).toBe(name);
    expect(updated.description).toBe('Updated by the e2e suite');
    expect(updated.surface.name).toBe(name);
    expect(updated.surface.sessionExpiryTimeInSeconds).toBe(3600);
    expect(updated.allowedRedirectUrlFilters).toEqual([{ url: 'https://example.com/*' }]);
  });

  it('archives a portal and hides it from listings', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let portal = await createPortal(fixture);

    let archived = await portalService.archivePortal({
      portal,
      auditScope: fixture.auditScope
    });
    expect(archived.status).toBe('archived');
    expect(archived.archivedAt).toBeTruthy();

    let surface = await db.consumerSurface.findUniqueOrThrow({
      where: { oid: portal.surfaceOid }
    });
    expect(surface.status).toBe('archived');

    let listed = await firstPage(portalService.listPortals({ instance: fixture.instance }));
    expect(listed.map(item => item.id)).not.toContain(portal.id);

    await expect(portalService.getPortalPublic({ portalId: portal.id })).rejects.toThrow();
  });

  it('reads and updates the project workforce configuration', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let current = await projectWorkforceConfigurationService.getProjectWorkforceConfiguration({
      project: fixture.project
    });
    expect(current.id).toBe(fixture.project.id);

    let toggled =
      await projectWorkforceConfigurationService.updateProjectWorkforceConfiguration({
        project: current,
        organization: fixture.organization,
        auditScope: fixture.auditScope,
        input: {
          autoAddOrganizationMembersToPortals: !current.autoAddOrganizationMembersToPortals
        }
      });
    expect(toggled.autoAddOrganizationMembersToPortals).toBe(
      !current.autoAddOrganizationMembersToPortals
    );

    let restored =
      await projectWorkforceConfigurationService.updateProjectWorkforceConfiguration({
        project: toggled,
        organization: fixture.organization,
        auditScope: fixture.auditScope,
        input: {
          autoAddOrganizationMembersToPortals: current.autoAddOrganizationMembersToPortals
        }
      });
    expect(restored.autoAddOrganizationMembersToPortals).toBe(
      current.autoAddOrganizationMembersToPortals
    );
  });
});
