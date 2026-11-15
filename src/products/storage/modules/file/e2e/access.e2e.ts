import { expectServiceError, firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { createResourceAuthorization } from '@metorial/module-access';
import { resourceActorService } from '@metorial/module-resource-actor';
import { describe, expect, it } from 'vitest';
import { fileService } from '../src';
import {
  createConsumer,
  createStore,
  createWritableFile,
  privileged,
  scopeOf
} from './_fixtures';

describe('module-file access', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('lets restricted consumers read and list only the files they created', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let alice = await createConsumer(fixture);
    let bob = await createConsumer(fixture);

    let aliceFile = await createWritableFile(fixture, { authorization: alice.authorization });
    let adminFile = await createWritableFile(fixture);
    expect(aliceFile.createdByResourceActorOid).toBe(alice.actor.oid);

    let read = await fileService.getFileById({
      ...scopeOf(fixture),
      fileId: aliceFile.id,
      authorization: alice.authorization
    });
    expect(read.id).toBe(aliceFile.id);

    let forbidden = await expectServiceError(
      fileService.getFileById({
        ...scopeOf(fixture),
        fileId: adminFile.id,
        authorization: alice.authorization
      }),
      'forbidden'
    );
    expect(forbidden.message).toBe(`Missing content_read access for file ${adminFile.id}`);

    await expectServiceError(
      fileService.getFileById({
        ...scopeOf(fixture),
        fileId: aliceFile.id,
        authorization: bob.authorization
      }),
      'forbidden'
    );

    let privilegedRead = await fileService.getFileById({
      ...scopeOf(fixture),
      fileId: aliceFile.id,
      authorization: privileged
    });
    expect(privilegedRead.id).toBe(aliceFile.id);

    let listIds = async (authorization: typeof privileged) =>
      (
        await firstPage(
          await fileService.listFiles({
            ...scopeOf(fixture),
            ids: [aliceFile.id, adminFile.id],
            authorization
          })
        )
      )
        .map(file => file.id)
        .sort();

    expect(await listIds(alice.authorization)).toEqual([aliceFile.id]);
    expect(await listIds(bob.authorization)).toEqual([]);
    expect(await listIds(privileged)).toEqual([aliceFile.id, adminFile.id].sort());
  });

  it('grants restricted consumers read access through public stores only', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let consumer = await createConsumer(fixture);
    let publicStore = await createStore(fixture, 'public_read');
    let privateStore = await createStore(fixture, 'private');

    let publicFile = await createWritableFile(fixture, {
      store: { id: publicStore.id, path: `/${uniqueId('public')}.dat` }
    });
    let privateFile = await createWritableFile(fixture, {
      store: { id: privateStore.id, path: `/${uniqueId('private')}.dat` }
    });

    let read = await fileService.getFileById({
      ...scopeOf(fixture),
      fileId: publicFile.id,
      authorization: consumer.authorization
    });
    expect(read.id).toBe(publicFile.id);

    await expectServiceError(
      fileService.getFileById({
        ...scopeOf(fixture),
        fileId: privateFile.id,
        authorization: consumer.authorization
      }),
      'forbidden'
    );

    let listed = await firstPage(
      await fileService.listFiles({
        ...scopeOf(fixture),
        ids: [publicFile.id, privateFile.id],
        authorization: consumer.authorization
      })
    );
    expect(listed.map(file => file.id)).toEqual([publicFile.id]);
  });

  it('only lets the creating actor or an organization actor delete a file by id', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let alice = await createConsumer(fixture);
    let bob = await createConsumer(fixture);

    let aliceFile = await createWritableFile(fixture, { authorization: alice.authorization });
    let denied = await expectServiceError(
      fileService.deleteFileById({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        fileId: aliceFile.id,
        authorization: bob.authorization
      }),
      'forbidden'
    );
    expect(denied.message).toBe(`Only the creating actor can delete file ${aliceFile.id}`);

    let ownDelete = await fileService.deleteFileById({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      fileId: aliceFile.id,
      authorization: alice.authorization
    });
    expect(ownDelete.status).toBe('deleted');

    let organizationActor = await resourceActorService.ensureOrganizationActor({
      project: fixture.project,
      organizationActorOid: fixture.actor.oid
    });
    let secondFile = await createWritableFile(fixture, { authorization: alice.authorization });
    let adminDelete = await fileService.deleteFileById({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      fileId: secondFile.id,
      authorization: createResourceAuthorization({
        restricted: false,
        resourceActor: organizationActor
      })
    });
    expect(adminDelete.status).toBe('deleted');
  });

  it('rejects authorizations whose actor belongs to another tenant', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let otherFixture = await loadOrganizationFixture(otherOrg.ids);
    let foreignConsumer = await createConsumer(otherFixture);
    let file = await createWritableFile(fixture);

    let error = await expectServiceError(
      fileService.getFileById({
        ...scopeOf(fixture),
        fileId: file.id,
        authorization: foreignConsumer.authorization
      }),
      'bad_request'
    );
    expect(error.message).toBe('ResourceActor does not belong to the supplied project.');

    let listError = await expectServiceError(
      Promise.resolve().then(async () =>
        firstPage(
          await fileService.listFiles({
            ...scopeOf(fixture),
            ids: [file.id],
            authorization: foreignConsumer.authorization
          })
        )
      ),
      'bad_request'
    );
    expect(listError.message).toBe('ResourceActor does not belong to the supplied project.');
  });

  it('keeps instance files invisible to other tenants', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let otherFixture = await loadOrganizationFixture(otherOrg.ids);
    let file = await createWritableFile(fixture);

    await expectServiceError(
      fileService.getFileById({
        ...scopeOf(otherFixture),
        fileId: file.id,
        authorization: privileged
      }),
      'not_found'
    );
    await expectServiceError(
      fileService.deleteFileById({
        ...scopeOf(otherFixture),
        auditScope: otherFixture.auditScope,
        fileId: file.id,
        authorization: privileged
      }),
      'not_found'
    );

    let listed = await firstPage(
      await fileService.listFiles({
        ...scopeOf(otherFixture),
        ids: [file.id],
        authorization: privileged
      })
    );
    expect(listed).toEqual([]);

    let stillThere = await fileService.getFileById({
      ...scopeOf(fixture),
      fileId: file.id,
      authorization: privileged
    });
    expect(stillThere.status).toBe('active');
  });

  it('scopes user- and organization-owned files to their owner', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let otherFixture = await loadOrganizationFixture(otherOrg.ids);

    let userFile = await fileService.createUploadedFile({
      user: fixture.user,
      auditScope: fixture.auditScope,
      purpose: 'user_image',
      file: new Blob(['avatar'], { type: 'image/png' }),
      input: { name: 'avatar.png', authorization: privileged }
    });
    let organizationFile = await fileService.createUploadedFile({
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      purpose: 'organization_image',
      file: new Blob(['logo'], { type: 'image/png' }),
      input: { name: 'logo.png', authorization: privileged }
    });

    expect(
      (
        await fileService.getFileById({
          user: fixture.user,
          fileId: userFile.id,
          authorization: privileged
        })
      ).id
    ).toBe(userFile.id);
    expect(
      (
        await fileService.getFileById({
          organization: fixture.organization,
          fileId: organizationFile.id,
          authorization: privileged
        })
      ).id
    ).toBe(organizationFile.id);

    for (let scope of [
      { user: otherFixture.user },
      { organization: fixture.organization },
      scopeOf(fixture)
    ]) {
      await expectServiceError(
        fileService.getFileById({ ...scope, fileId: userFile.id, authorization: privileged }),
        'not_found'
      );
    }

    for (let scope of [
      { organization: otherFixture.organization },
      { user: fixture.user },
      scopeOf(fixture)
    ]) {
      await expectServiceError(
        fileService.getFileById({
          ...scope,
          fileId: organizationFile.id,
          authorization: privileged
        }),
        'not_found'
      );
    }
  });
});
