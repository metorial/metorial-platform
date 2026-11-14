import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { fileLinkService, fileReferenceService, fileService } from '../src';
import {
  createStore,
  createWritableFile,
  linkFile,
  objectExists,
  privileged,
  referenceLink,
  scopeOf
} from './_fixtures';

describe('module-file references', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('counts references per link and blocks deleting referenced links and files', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let file = await createWritableFile(fixture);
    let link = await linkFile(fixture, file);
    let entityId = uniqueId('entity');

    let first = await referenceLink(fixture, link, { entityId });
    let again = await referenceLink(fixture, link, { entityId });
    expect(again.id).toBe(first.id);
    expect(first.fileLink.file.id).toBe(file.id);

    let second = await referenceLink(fixture, link);
    expect(await db.fileReference.count({ where: { fileLinkOid: link.oid } })).toBe(2);
    expect(await fileReferenceService.hasReferences({ fileLink: link })).toBe(true);
    expect(await fileReferenceService.hasReferencesForFile({ file })).toBe(true);

    let fileBlocked = await expectServiceError(
      fileService.deleteFile({ file, auditScope: fixture.auditScope }),
      'bad_request'
    );
    expect(fileBlocked.message).toBe('Cannot delete file: it has active references');

    let linkBlocked = await expectServiceError(
      fileLinkService.deleteFileLink({ fileLink: link }),
      'bad_request'
    );
    expect(linkBlocked.message).toBe('Cannot delete link: it has active references');

    await fileReferenceService.deleteReferenceAndLinkIfUnused({ fileReference: first });
    expect(await db.fileReference.count({ where: { id: first.id } })).toBe(0);
    expect(await db.fileLink.count({ where: { id: link.id } })).toBe(1);

    let removed = await fileReferenceService.deleteFileReferenceByIdAndCleanup({
      fileReferenceId: second.id
    });
    expect(removed?.id).toBe(second.id);
    expect(await db.fileLink.count({ where: { id: link.id } })).toBe(0);
    expect(await fileReferenceService.hasReferencesForFile({ file })).toBe(false);

    expect(
      await fileReferenceService.deleteFileReferenceByIdAndCleanup({
        fileReferenceId: second.id
      })
    ).toBeNull();

    let deleted = await fileService.deleteFile({ file, auditScope: fixture.auditScope });
    expect(deleted.status).toBe('deleted');
  });

  it('reuses a reference by id and moves it to another link', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let file = await createWritableFile(fixture);
    let firstLink = await linkFile(fixture, file);
    let secondLink = await linkFile(fixture, file);

    let reference = await referenceLink(fixture, firstLink);
    let moved = await fileReferenceService.upsertFileReference({
      ...scopeOf(fixture),
      fileLink: secondLink,
      input: { id: reference.id, entityType: 'e2e_moved', entityId: reference.entityId }
    });

    expect(moved.id).toBe(reference.id);
    expect(moved.fileLinkOid).toBe(secondLink.oid);
    expect(moved.entityType).toBe('e2e_moved');
    expect(await fileReferenceService.hasReferences({ fileLink: firstLink })).toBe(false);
  });

  it('lists references by entity, link and file within the instance', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let otherFixture = await loadOrganizationFixture(otherOrg.ids);
    let entityType = uniqueId('e2e_type');

    let fileA = await createWritableFile(fixture);
    let fileB = await createWritableFile(fixture);
    let linkA = await linkFile(fixture, fileA);
    let linkB = await linkFile(fixture, fileB);
    let refA = await referenceLink(fixture, linkA, { entityType });
    let refB = await referenceLink(fixture, linkB, { entityType });

    let ids = async (
      query: Omit<
        Parameters<typeof fileReferenceService.listFileReferences>[0],
        'project' | 'instance'
      >
    ) =>
      (
        await firstPage(
          await fileReferenceService.listFileReferences({ ...scopeOf(fixture), ...query })
        )
      )
        .map(reference => reference.id)
        .sort();

    expect(await ids({ entityType })).toEqual([refA.id, refB.id].sort());
    expect(await ids({ entityType, entityId: refA.entityId })).toEqual([refA.id]);
    expect(await ids({ entityIds: [refB.entityId] })).toEqual([refB.id]);
    expect(await ids({ fileLinkId: linkA.id })).toEqual([refA.id]);
    expect(await ids({ fileIds: [fileB.id] })).toEqual([refB.id]);

    let byReference = await firstPage(
      await fileService.listFiles({
        ...scopeOf(fixture),
        fileReferenceIds: [refB.id],
        authorization: privileged
      })
    );
    expect(byReference.map(file => file.id)).toEqual([fileB.id]);

    let own = await fileReferenceService.getFileReferenceById({
      ...scopeOf(fixture),
      fileReferenceId: refA.id
    });
    expect(own.fileLink.id).toBe(linkA.id);

    await expectServiceError(
      fileReferenceService.getFileReferenceById({
        ...scopeOf(otherFixture),
        fileReferenceId: refA.id
      }),
      'not_found'
    );

    let foreign = await firstPage(
      await fileReferenceService.listFileReferences({
        ...scopeOf(otherFixture),
        ids: [refA.id, refB.id]
      })
    );
    expect(foreign).toEqual([]);

    let foreignByEntity = await firstPage(
      await fileReferenceService.listFileReferences({ ...scopeOf(otherFixture), entityType })
    );
    expect(foreignByEntity).toEqual([]);
  });

  it('keeps store-attached files referenced and deletes them once replaced', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await createStore(fixture);
    let path = `/${uniqueId('attached')}.dat`;

    let original = await createWritableFile(fixture, { store: { id: store.id, path } });
    let storeReferences = await db.fileReference.findMany({
      where: { entityType: 'store_item', fileLink: { fileOid: original.oid } }
    });
    expect(storeReferences).toHaveLength(1);

    let blocked = await expectServiceError(
      fileService.deleteFile({ file: original, auditScope: fixture.auditScope }),
      'bad_request'
    );
    expect(blocked.message).toBe('Cannot delete file: it has active references');

    let replacement = await createWritableFile(fixture, {
      store: { id: store.id, path, replace: true }
    });
    expect(replacement.id).not.toBe(original.id);

    let displaced = await db.file.findUniqueOrThrow({ where: { oid: original.oid } });
    expect(displaced.status).toBe('deleted');
    expect(await fileReferenceService.hasReferencesForFile({ file: original })).toBe(false);
    expect(
      await db.fileReference.count({
        where: { entityType: 'store_item', fileLink: { fileOid: replacement.oid } }
      })
    ).toBe(1);

    await eventually(async () => expect(await objectExists(original.storeId)).toBe(false));
    expect(await objectExists(replacement.storeId)).toBe(true);
  });
});
