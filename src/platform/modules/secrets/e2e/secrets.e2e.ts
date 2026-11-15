import { firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { keyProviderService } from '../src';

describe('module-secrets', () => {
  let org = useOrganization();

  it('links the project to a Nebula tenant when listing key providers', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let keyProviders = await firstPage(
      await keyProviderService.listKeyProviders({
        organization: fixture.organization,
        project: fixture.project
      })
    );
    expect(Array.isArray(keyProviders)).toBe(true);

    let project = await db.project.findUniqueOrThrow({ where: { oid: fixture.project.oid } });
    expect(project.nebulaTenantId).toBeTruthy();
    expect(project.internalTenantIdentifier).toBeTruthy();
  });

  it('creates a managed key provider and makes it the default', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('kp');

    let created = await keyProviderService.createManagedKeyProvider({
      organization: fixture.organization,
      project: fixture.project,
      performedBy: fixture.actor,
      context: fixture.context,
      name
    });
    expect(created.name).toBe(name);
    expect(created.isMetorialManaged).toBe(true);

    let fetched = await keyProviderService.getKeyProvider({
      organization: fixture.organization,
      project: fixture.project,
      keyProviderId: created.id
    });
    expect(fetched.id).toBe(created.id);

    let listed = await firstPage(
      await keyProviderService.listKeyProviders({
        organization: fixture.organization,
        project: fixture.project
      })
    );
    expect(listed.map(item => item.id)).toContain(created.id);

    let defaulted = await keyProviderService.setDefaultKeyProvider({
      organization: fixture.organization,
      project: fixture.project,
      performedBy: fixture.actor,
      context: fixture.context,
      keyProviderId: created.id
    });
    expect(defaulted.isDefault).toBe(true);
  });
});
