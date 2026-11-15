import { eventually, firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { outpostCredentialService, outpostRegistrationService, outpostService } from '../src';

describe('module-outpost', () => {
  let org = useOrganization();

  it('creates, updates, disables and deletes an outpost', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('outpost');

    let outpost = await outpostService.createOutpost({
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: { name, description: 'E2E outpost' }
    });
    expect(outpost.status).toBe('active');
    expect(outpost.organization.id).toBe(org.ids.organizationId);

    let owned = await outpostService.getOwnedOutpostById({
      organization: fixture.organization,
      outpostId: outpost.id
    });
    expect(owned.name).toBe(name);

    let outposts = await firstPage(
      await outpostService.listOutpostsInFamily({ organization: fixture.organization })
    );
    expect(outposts.map(item => item.id)).toContain(outpost.id);

    let renamed = uniqueId('renamed');
    let updated = await outpostService.updateOutpost({
      outpost,
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: { name: renamed }
    });
    expect(updated.name).toBe(renamed);

    await expect(
      outpostService.deleteOutpost({
        outpost: updated,
        organization: fixture.organization,
        auditScope: fixture.auditScope
      })
    ).rejects.toThrow(/disabled before/);

    let disabled = await outpostService.disableOutpost({
      outpost: updated,
      organization: fixture.organization,
      auditScope: fixture.auditScope
    });
    expect(disabled.status).toBe('disabled');

    let deleted = await outpostService.deleteOutpost({
      outpost: disabled,
      organization: fixture.organization,
      auditScope: fixture.auditScope
    });
    expect(deleted.status).toBe('deleted');

    await expect(
      outpostService.getOwnedOutpostById({
        organization: fixture.organization,
        outpostId: outpost.id
      })
    ).rejects.toThrow();
  });

  it('issues credentials that resolve for enrollment until disabled', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let outpost = await outpostService.createOutpost({
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: { name: uniqueId('outpost') }
    });

    let { credential, envelope } = await outpostCredentialService.createCredential({
      outpost,
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: { name: uniqueId('credential') }
    });
    expect(credential.status).toBe('active');
    expect(envelope.length).toBeGreaterThan(0);

    let credentials = await firstPage(
      await outpostCredentialService.listCredentials({ outpost })
    );
    expect(credentials.map(item => item.id)).toEqual([credential.id]);

    let resolved = await outpostRegistrationService.resolveEnrollmentCredential({
      outpostId: outpost.id,
      credentialId: credential.id
    });
    expect(resolved.status).toBe('ok');

    let manifest = await outpostRegistrationService.resolveManifest({ outpostId: outpost.id });
    expect(manifest.status).toBe('ok');

    await outpostCredentialService.disableCredential({
      credential,
      outpost,
      organization: fixture.organization,
      auditScope: fixture.auditScope
    });

    await eventually(async () => {
      let revoked = await outpostRegistrationService.resolveEnrollmentCredential({
        outpostId: outpost.id,
        credentialId: credential.id
      });
      expect(revoked.status).toBe('revoked');
    });

    let unknown = await outpostRegistrationService.resolveEnrollmentCredential({
      outpostId: outpost.id,
      credentialId: uniqueId('opc')
    });
    expect(unknown.status).toBe('unknown');
  });
});
