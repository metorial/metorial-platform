import { expectServiceError, firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { decodeCredentialEnvelope } from '@metorial-outpost/credential-envelope';
import { base64url, Ed25519 } from '@metorial-outpost/crypto';
import { describe, expect, it } from 'vitest';
import { outpostCredentialService, outpostService } from '../src';
import { createOutpostWithCredential } from './_fixtures';

describe('module-outpost outposts and credentials', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('enforces the outpost status machine', async () => {
    let { fixture, outpost } = await createOutpostWithCredential(org.ids);
    let scope = { organization: fixture.organization, auditScope: fixture.auditScope };

    await expectServiceError(outpostService.enableOutpost({ ...scope, outpost }), 'forbidden');
    await expectServiceError(outpostService.deleteOutpost({ ...scope, outpost }), 'forbidden');

    let disabled = await outpostService.disableOutpost({ ...scope, outpost });
    expect(disabled.status).toBe('disabled');

    await expectServiceError(
      outpostService.disableOutpost({ ...scope, outpost: disabled }),
      'forbidden'
    );
    await expectServiceError(
      outpostService.updateOutpost({
        ...scope,
        outpost: disabled,
        input: { name: 'renamed' }
      }),
      'forbidden'
    );
    expect((await db.outpost.findUniqueOrThrow({ where: { oid: outpost.oid } })).name).toBe(
      outpost.name
    );

    let deleted = await outpostService.deleteOutpost({ ...scope, outpost: disabled });
    expect(deleted.status).toBe('deleted');

    await expectServiceError(
      outpostService.enableOutpost({ ...scope, outpost: deleted }),
      'forbidden'
    );
    await expectServiceError(
      outpostCredentialService.createCredential({
        ...scope,
        outpost: deleted,
        input: { name: uniqueId('credential') }
      }),
      'forbidden'
    );
    await expectServiceError(
      outpostService.getOutpostInFamily({ ...scope, outpostId: outpost.id }),
      'not_found'
    );
    expect(
      (await firstPage(await outpostService.listOutpostsInFamily(scope))).map(item => item.id)
    ).not.toContain(outpost.id);
  });

  it('hides outposts from organizations outside the account family', async () => {
    let { outpost } = await createOutpostWithCredential(org.ids);
    let foreign = await loadOrganizationFixture(otherOrg.ids);
    let own = await loadOrganizationFixture(org.ids);

    expect(
      (
        await outpostService.getOutpostInFamily({
          organization: own.organization,
          outpostId: outpost.id
        })
      ).id
    ).toBe(outpost.id);

    await expectServiceError(
      outpostService.getOutpostInFamily({
        organization: foreign.organization,
        outpostId: outpost.id
      }),
      'not_found'
    );
    await expectServiceError(
      outpostService.getOwnedOutpostById({
        organization: foreign.organization,
        outpostId: outpost.id
      }),
      'not_found'
    );

    let foreignList = await firstPage(
      await outpostService.listOutpostsInFamily({ organization: foreign.organization })
    );
    expect(foreignList.map(item => item.id)).not.toContain(outpost.id);
    expect(foreignList.every(item => item.organizationOid == foreign.organization.oid)).toBe(
      true
    );
  });

  it('issues credential envelopes that match the stored public key', async () => {
    let { outpost, credential, envelope } = await createOutpostWithCredential(org.ids);

    let decoded = decodeCredentialEnvelope(envelope);
    expect(decoded).toMatchObject({
      version: 1,
      outpost_id: outpost.id,
      credential_id: credential.id
    });
    expect(decoded.endpoint).toMatch(/^https?:\/\//);

    let privateKey = await Ed25519.importPrivateKey(base64url.decode(decoded.private_key));
    let message = new TextEncoder().encode(uniqueId('message'));
    let signature = await Ed25519.sign(privateKey, message);
    let publicKey = await Ed25519.importPublicKey(new Uint8Array(credential.publicKey));
    expect(await Ed25519.verify(publicKey, signature, message)).toBe(true);

    let stored = await db.outpostCredential.findUniqueOrThrow({
      where: { oid: credential.oid }
    });
    expect(stored.envelopePreview).toBeTruthy();
    expect(stored.envelopePreview).not.toContain(decoded.private_key);
    expect(
      JSON.stringify(stored, (_, value) =>
        typeof value == 'bigint' ? value.toString() : value
      )
    ).not.toContain(decoded.private_key);
  });

  it('enforces the credential status machine and scopes lookups to the outpost', async () => {
    let { fixture, outpost, credential } = await createOutpostWithCredential(org.ids);
    let sibling = await createOutpostWithCredential(org.ids);
    let scope = {
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      outpost
    };

    await expectServiceError(
      outpostCredentialService.deleteCredential({ ...scope, credential }),
      'forbidden'
    );

    expect(
      (
        await outpostCredentialService.getCredentialById({
          outpost,
          credentialId: credential.id
        })
      ).id
    ).toBe(credential.id);
    await expectServiceError(
      outpostCredentialService.getCredentialById({
        outpost: sibling.outpost,
        credentialId: credential.id
      }),
      'not_found'
    );

    let disabled = await outpostCredentialService.disableCredential({ ...scope, credential });
    expect(disabled.status).toBe('disabled');
    await expectServiceError(
      outpostCredentialService.disableCredential({ ...scope, credential: disabled }),
      'forbidden'
    );

    let deleted = await outpostCredentialService.deleteCredential({
      ...scope,
      credential: disabled
    });
    expect(deleted.status).toBe('deleted');

    await expectServiceError(
      outpostCredentialService.getCredentialById({ outpost, credentialId: credential.id }),
      'not_found'
    );
    expect(
      await firstPage(await outpostCredentialService.listCredentials({ outpost }))
    ).toEqual([]);
    expect(
      (await firstPage(await outpostCredentialService.listCredentials(sibling))).map(
        item => item.id
      )
    ).toEqual([sibling.credential.id]);
  });
});
