import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db';
import { documentCleanupService, documentDraftService, documentService } from '../../services';
import { cargoClient } from '../../test/client';
import { cleanDatabase } from '../../test/setup';

let subtractHours = (date: Date, hours: number) => new Date(date.getTime() - hours * 60 * 60 * 1000);
let subtractDays = (date: Date, days: number) => new Date(date.getTime() - days * 24 * 60 * 60 * 1000);

let createScope = async () => {
  let tenant = await cargoClient.tenant.upsert({
    identifier: 'tenant-documents',
    name: 'Tenant Documents'
  });

  let environment = await cargoClient.environment.upsert({
    tenantId: tenant.id,
    identifier: 'prod',
    name: 'Production',
    type: 'production'
  });

  return {
    tenant,
    environment
  };
};

let createActor = async (
  tenantId: string,
  d: {
    identifier?: string;
    name?: string;
  } = {}
) =>
  await cargoClient.actor.upsert({
    tenantId,
    identifier: d.identifier ?? 'actor-1',
    name: d.name ?? 'Actor One'
  });

let createStore = async (tenantId: string, environmentId: string, name = 'Docs Store') =>
  await cargoClient.store.create({
    tenantId,
    environmentId,
    name
  });

let flushDocument = async (documentId: string) =>
  await documentService.flushDocumentDraft({
    documentId,
    force: true
  });

let syncChildVersions = async (parentDocumentVersionId: string, limit = 100) => {
  let cursor: string | undefined;
  let downstreamVersionIds: string[] = [];

  while (true) {
    let result = await documentService.listSyncableChildDocumentIdsForVersionSync({
      parentDocumentVersionId,
      cursor,
      limit
    });

    for (let childDocumentId of result.childDocumentIds) {
      let syncResult = await documentService.syncChildDocumentVersionFromParentVersion({
        parentDocumentVersionId,
        childDocumentId
      });

      if (syncResult?.createdVersionId) {
        downstreamVersionIds.push(syncResult.createdVersionId);
      }
    }

    if (!result.nextCursor) break;

    cursor = result.nextCursor;
  }

  for (let downstreamVersionId of downstreamVersionIds) {
    await syncChildVersions(downstreamVersionId, limit);
  }
};

describe('cargo document.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('creates, gets, lists, and deletes document resources', async () => {
    let { tenant, environment } = await createScope();
    let actor = await createActor(tenant.id);

    let fetchedActor = await cargoClient.actor.get({
      tenantId: tenant.id,
      actorId: actor.id
    });

    expect(fetchedActor).toMatchObject({
      id: actor.id,
      identifier: 'actor-1'
    });

    let created = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Notes',
      content: 'hello world',
      actorId: actor.id
    });

    let listed = await cargoClient.document.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });

    let fetched = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id
    });

    let participants = await cargoClient.documentParticipant.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id,
      limit: 10
    });

    let versions = await cargoClient.documentVersion.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id,
      limit: 10
    });

    expect(listed.items).toHaveLength(1);
    expect(fetched).toMatchObject({
      id: created.id,
      title: 'Notes',
      content: 'hello world',
      currentVersionId: expect.any(String),
      file: {
        id: created.fileId,
        type: 'document',
        documentId: created.id
      }
    });
    expect(participants.items).toHaveLength(1);
    expect(participants.items[0]).toMatchObject({
      role: 'editor',
      editCount: 1,
      actor: {
        id: actor.id
      },
      lastEditedAt: expect.any(Date),
      lastViewedAt: expect.any(Date)
    });
    expect(versions.items).toHaveLength(1);
    expect(versions.items[0]).toMatchObject({
      documentId: created.id,
      content: 'hello world',
      listEditedAt: expect.any(Date),
      editors: [{ id: actor.id }]
    });

    let deleted = await cargoClient.document.delete({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id
    });

    expect(deleted.status).toBe('deleted');

    let listedAfterDelete = await cargoClient.document.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });

    let deletedFile = await cargoClient.file.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileId: created.fileId
    });

    expect(listedAfterDelete.items).toHaveLength(0);
    expect(deletedFile).toMatchObject({
      id: created.fileId,
      type: 'document',
      documentId: created.id,
      status: 'deleted'
    });
  });

  it('upserts viewer participants from store permissions on get and promotes them on edit', async () => {
    let { tenant, environment } = await createScope();
    let viewer = await createActor(tenant.id, {
      identifier: 'viewer-1',
      name: 'Viewer One'
    });
    let store = await createStore(tenant.id, environment.id);

    let created = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Viewed',
      content: 'hello world',
      store: {
        id: store.id,
        path: '/viewed.md'
      }
    });

    await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id,
      actorId: viewer.id,
      defaultPermissions: ['content_read']
    });

    let participantsAfterView = await cargoClient.documentParticipant.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id,
      limit: 10
    });

    expect(participantsAfterView.items).toHaveLength(1);
    expect(participantsAfterView.items[0]).toMatchObject({
      role: 'viewer',
      editCount: 0,
      actor: {
        id: viewer.id
      },
      lastEditedAt: null,
      lastViewedAt: expect.any(Date)
    });

    let viewedAt = participantsAfterView.items[0]!.lastViewedAt;

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id,
      content: 'updated',
      actorId: viewer.id,
      defaultPermissions: ['content_write'],
      overridePermissions: true
    });
    await flushDocument(created.id);

    let participantsAfterEdit = await cargoClient.documentParticipant.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id,
      limit: 10
    });

    expect(participantsAfterEdit.items[0]).toMatchObject({
      role: 'editor',
      editCount: 1,
      actor: {
        id: viewer.id
      },
      lastEditedAt: expect.any(Date),
      lastViewedAt: expect.any(Date)
    });
    expect(participantsAfterEdit.items[0]!.lastViewedAt!.getTime()).toBeGreaterThanOrEqual(
      viewedAt!.getTime()
    );
  });

  it('stores creator ownership, allows owner access, and persists clone ownership', async () => {
    let { tenant, environment } = await createScope();
    let owner = await createActor(tenant.id, {
      identifier: 'owner-1',
      name: 'Owner One'
    });
    let reader = await createActor(tenant.id, {
      identifier: 'reader-1',
      name: 'Reader One'
    });
    let store = await createStore(tenant.id, environment.id, 'Owned Store');

    let created = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Owned',
      content: 'owner content',
      actorId: owner.id,
      defaultPermissions: ['content_write'],
      overridePermissions: true,
      store: {
        id: store.id,
        path: '/owned.md'
      }
    });

    let createdRecord = await db.document.findUnique({
      where: {
        id: created.id
      }
    });

    expect(createdRecord?.createdByTenantActorOid).toBeTruthy();

    let ownedGet = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id,
      actorId: owner.id
    });

    expect(ownedGet.id).toBe(created.id);

    let cloned = await cargoClient.document.clone({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id,
      actorId: reader.id,
      defaultPermissions: ['content_read']
    });

    let clonedRecord = await db.document.findUnique({
      where: {
        id: cloned.id
      }
    });
    let clonedParticipants = await cargoClient.documentParticipant.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: cloned.id,
      limit: 10
    });

    expect(clonedRecord?.createdByTenantActorOid).toBeTruthy();
    expect(clonedParticipants.items.map(item => item.actor.id)).toContain(reader.id);
  });

  it('materializes transient store participants in document participant lists', async () => {
    let { tenant, environment } = await createScope();
    let creator = await createActor(tenant.id, {
      identifier: 'creator-2',
      name: 'Creator Two'
    });
    let viewer = await createActor(tenant.id, {
      identifier: 'viewer-2',
      name: 'Viewer Two'
    });
    let store = await createStore(tenant.id, environment.id, 'Participant Store');

    let created = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Participants',
      content: 'participant content',
      actorId: creator.id,
      defaultPermissions: ['content_write'],
      overridePermissions: true,
      store: {
        id: store.id,
        path: '/participants.md'
      }
    });

    let participants = await cargoClient.documentParticipant.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id,
      actorId: viewer.id,
      defaultPermissions: ['content_read'],
      limit: 10
    });

    expect(participants.items.map(item => item.actor.id)).toEqual(
      expect.arrayContaining([creator.id, viewer.id])
    );
  });

  it('reuses the active version for writes within three hours', async () => {
    let { tenant, environment } = await createScope();
    let actor = await createActor(tenant.id);

    let created = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Draft',
      content: 'v1',
      actorId: actor.id
    });

    let updated = await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id,
      content: 'v2',
      actorId: actor.id
    });
    let beforeFlushVersions = await cargoClient.documentVersion.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id,
      limit: 10
    });

    await flushDocument(created.id);

    let versions = await cargoClient.documentVersion.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id,
      limit: 10
    });

    expect(updated.currentVersionId).toBe(created.currentVersionId);
    expect(updated.content).toBe('v2');
    expect(beforeFlushVersions.items).toHaveLength(1);
    expect(beforeFlushVersions.items[0]).toMatchObject({
      id: created.currentVersionId!,
      content: 'v1'
    });
    expect(versions.items).toHaveLength(1);
    expect(versions.items[0]).toMatchObject({
      id: created.currentVersionId!,
      content: 'v2',
      listEditedAt: expect.any(Date)
    });

    let flushed = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id
    });

    expect(flushed.content).toBe('v2');
  });

  it('creates a new version after three hours and snapshots the retired version', async () => {
    let { tenant, environment } = await createScope();
    let actor = await createActor(tenant.id);

    let created = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Versioned',
      content: 'first',
      actorId: actor.id
    });

    await db.documentVersion.update({
      where: {
        id: created.currentVersionId!
      },
      data: {
        createdAt: subtractHours(new Date(), 4)
      }
    });

    let updated = await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id,
      content: 'second',
      actorId: actor.id
    });
    let beforeFlushVersions = await cargoClient.documentVersion.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id,
      limit: 10
    });

    await flushDocument(created.id);
    let flushed = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id
    });

    let versions = await cargoClient.documentVersion.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id,
      limit: 10
    });

    expect(updated.currentVersionId).toBe(created.currentVersionId);
    expect(beforeFlushVersions.items).toHaveLength(1);
    expect(flushed.currentVersionId).not.toBe(created.currentVersionId);
    expect(versions.items).toHaveLength(2);
    expect(versions.items[0]).toMatchObject({
      id: flushed.currentVersionId,
      content: 'second',
      listEditedAt: expect.any(Date),
      previousVersionId: created.currentVersionId!
    });
    expect(versions.items[1]).toMatchObject({
      id: created.currentVersionId!,
      content: 'first'
    });
  });

  it('forks a cloned document on first write and leaves the source untouched', async () => {
    let { tenant, environment } = await createScope();

    let source = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Source',
      content: 'shared'
    });

    let cloned = await cargoClient.document.clone({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: source.id,
      title: 'Clone'
    });

    let sourceBeforeWrite = await db.document.findUnique({
      where: {
        id: source.id
      }
    });
    let cloneBeforeWrite = await db.document.findUnique({
      where: {
        id: cloned.id
      }
    });

    let updatedClone = await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: cloned.id,
      content: 'clone-only'
    });
    let cloneAfterFirstWrite = await db.document.findUnique({
      where: {
        id: cloned.id
      }
    });
    await flushDocument(cloned.id);

    let sourceAfterWrite = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: source.id
    });
    let cloneAfterFlush = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: cloned.id
    });
    let cloneAfterWrite = await db.document.findUnique({
      where: {
        id: cloned.id
      }
    });

    expect(cloned.file.storeId).toBe(source.file.storeId);
    expect(cloneBeforeWrite?.isContentOwner).toBe(false);
    expect(sourceBeforeWrite?.contentOid).toBe(cloneBeforeWrite?.contentOid);
    expect(updatedClone.currentVersionId).toBe(cloned.currentVersionId);
    expect(updatedClone.content).toBe('clone-only');
    expect(cloneAfterFirstWrite?.isContentOwner).toBe(true);
    expect(sourceAfterWrite.content).toBe('shared');
    expect(cloneAfterWrite?.isContentOwner).toBe(true);
    expect(sourceBeforeWrite?.contentOid).not.toBe(cloneAfterWrite?.contentOid);
  });

  it('does not flip ownership on title-only updates for linked children', async () => {
    let { tenant, environment } = await createScope();

    let parent = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Parent',
      content: 'shared'
    });

    let child = await cargoClient.document.clone({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: parent.id,
      title: 'Child'
    });

    let updatedChild = await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: child.id,
      title: 'Child Renamed'
    });
    let childRecord = await db.document.findUnique({
      where: {
        id: child.id
      }
    });

    expect(updatedChild.title).toBe('Child Renamed');
    expect(updatedChild.file.storeId).toBe(parent.file.storeId);
    expect(childRecord?.isContentOwner).toBe(false);
  });

  it('stops treating a child as linked immediately after a divergent write', async () => {
    let { tenant, environment } = await createScope();

    let parent = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Parent',
      content: 'shared'
    });

    let child = await cargoClient.document.clone({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: parent.id,
      title: 'Child'
    });

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: child.id,
      content: 'child-owned'
    });

    let childRecord = await db.document.findUnique({
      where: {
        id: child.id
      }
    });

    await documentDraftService.clearDocumentState(child.id);

    let linkedChildren = await documentService.listLinkedChildDocumentsForLiveSync({
      parentDocumentId: parent.id
    });
    let syncableChildren = await documentService.listSyncableChildDocumentIdsForVersionSync({
      parentDocumentVersionId: parent.currentVersionId!,
      limit: 10
    });

    expect(childRecord?.isContentOwner).toBe(true);
    expect(linkedChildren.map(document => document.id)).not.toContain(child.id);
    expect(syncableChildren.childDocumentIds).not.toContain(child.id);
  });

  it('keeps parent sync when a child writes the same content as the parent', async () => {
    let { tenant, environment } = await createScope();

    let parent = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Parent',
      content: 'first'
    });

    let child = await cargoClient.document.clone({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: parent.id,
      title: 'Child'
    });

    await db.documentVersion.update({
      where: {
        id: parent.currentVersionId!
      },
      data: {
        createdAt: subtractHours(new Date(), 4)
      }
    });

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: parent.id,
      content: 'second'
    });
    let flushedParent = await flushDocument(parent.id);

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: child.id,
      content: 'second'
    });
    await flushDocument(child.id);

    let childAfterMatchingWrite = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: child.id
    });
    let childRecordAfterMatchingWrite = await db.document.findUnique({
      where: {
        id: child.id
      }
    });
    let childVersionsAfterMatchingWrite = await cargoClient.documentVersion.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: child.id,
      limit: 10
    });
    let parentRecordAfterFirstUpdate = await db.document.findUnique({
      where: {
        id: parent.id
      }
    });

    expect(flushedParent!.content).toBe('second');
    expect(childAfterMatchingWrite.content).toBe('second');
    expect(childRecordAfterMatchingWrite?.isContentOwner).toBe(false);
    expect(childRecordAfterMatchingWrite?.contentOid).toBe(parentRecordAfterFirstUpdate?.contentOid);
    expect(childVersionsAfterMatchingWrite.items).toHaveLength(1);

    await db.documentVersion.update({
      where: {
        id: flushedParent!.currentVersion!.id
      },
      data: {
        createdAt: subtractHours(new Date(), 4)
      }
    });

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: parent.id,
      content: 'third'
    });
    let flushedParentAgain = await flushDocument(parent.id);

    await syncChildVersions(flushedParentAgain!.currentVersion!.id);

    let childAfterLaterSync = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: child.id
    });
    let childRecordAfterLaterSync = await db.document.findUnique({
      where: {
        id: child.id
      }
    });
    let childVersionsAfterLaterSync = await cargoClient.documentVersion.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: child.id,
      limit: 10
    });

    expect(childAfterLaterSync.content).toBe('third');
    expect(childRecordAfterLaterSync?.isContentOwner).toBe(false);
    expect(childVersionsAfterLaterSync.items).toHaveLength(2);
    expect(childVersionsAfterLaterSync.items[0]).toMatchObject({
      previousVersionId: child.currentVersionId!,
      content: 'third'
    });
  });

  it('syncs a new parent version to cloned children that still follow the parent', async () => {
    let { tenant, environment } = await createScope();

    let parent = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Parent',
      content: 'first'
    });

    let child = await cargoClient.document.clone({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: parent.id,
      title: 'Child'
    });

    await db.documentVersion.update({
      where: {
        id: parent.currentVersionId!
      },
      data: {
        createdAt: subtractHours(new Date(), 4)
      }
    });

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: parent.id,
      content: 'second'
    });
    let flushedParent = await flushDocument(parent.id);

    await syncChildVersions(flushedParent!.currentVersion!.id);

    let parentAfterSync = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: parent.id
    });
    let childAfterSync = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: child.id
    });
    let childVersions = await cargoClient.documentVersion.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: child.id,
      limit: 10
    });
    let childRecord = await db.document.findUnique({
      where: {
        id: child.id
      }
    });

    expect(parentAfterSync.currentVersionId).toBe(flushedParent!.currentVersion!.id);
    expect(parentAfterSync.content).toBe('second');
    expect(childAfterSync.content).toBe('second');
    expect(childRecord?.isContentOwner).toBe(false);
    expect(childVersions.items).toHaveLength(2);
    expect(childVersions.items[0]).toMatchObject({
      content: 'second',
      previousVersionId: child.currentVersionId!,
      listEditedAt: expect.any(Date)
    });
    expect(childVersions.items[1]).toMatchObject({
      id: child.currentVersionId!,
      content: 'first'
    });
  });

  it('cascades synced versions to descendants at arbitrary depth', async () => {
    let { tenant, environment } = await createScope();

    let root = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Root',
      content: 'first'
    });

    let child = await cargoClient.document.clone({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: root.id,
      title: 'Child'
    });
    let grandchild = await cargoClient.document.clone({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: child.id,
      title: 'Grandchild'
    });

    await db.documentVersion.update({
      where: {
        id: root.currentVersionId!
      },
      data: {
        createdAt: subtractHours(new Date(), 4)
      }
    });

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: root.id,
      content: 'second'
    });
    let flushedRoot = await flushDocument(root.id);

    await syncChildVersions(flushedRoot!.currentVersion!.id);

    let childAfterSync = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: child.id
    });
    let grandchildAfterSync = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: grandchild.id
    });
    let childVersions = await cargoClient.documentVersion.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: child.id,
      limit: 10
    });
    let grandchildVersions = await cargoClient.documentVersion.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: grandchild.id,
      limit: 10
    });

    expect(childAfterSync.content).toBe('second');
    expect(grandchildAfterSync.content).toBe('second');
    expect(childVersions.items).toHaveLength(2);
    expect(grandchildVersions.items).toHaveLength(2);
    expect(childVersions.items[0]).toMatchObject({
      previousVersionId: child.currentVersionId!,
      content: 'second'
    });
    expect(grandchildVersions.items[0]).toMatchObject({
      previousVersionId: grandchild.currentVersionId!,
      content: 'second'
    });
  });

  it('does not sync children that already have a local draft', async () => {
    let { tenant, environment } = await createScope();

    let parent = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Parent',
      content: 'first'
    });

    let child = await cargoClient.document.clone({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: parent.id,
      title: 'Child'
    });

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: child.id,
      content: 'child draft'
    });

    await db.documentVersion.update({
      where: {
        id: parent.currentVersionId!
      },
      data: {
        createdAt: subtractHours(new Date(), 4)
      }
    });

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: parent.id,
      content: 'second'
    });
    let flushedParent = await flushDocument(parent.id);

    let firstPage = await documentService.listSyncableChildDocumentIdsForVersionSync({
      parentDocumentVersionId: flushedParent!.currentVersion!.id,
      limit: 100
    });
    let syncResult = await documentService.syncChildDocumentVersionFromParentVersion({
      parentDocumentVersionId: flushedParent!.currentVersion!.id,
      childDocumentId: child.id
    });
    let childAfterAttempt = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: child.id
    });
    let childVersions = await cargoClient.documentVersion.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: child.id,
      limit: 10
    });

    expect(firstPage.childDocumentIds).not.toContain(child.id);
    expect(syncResult).toBeNull();
    expect(childAfterAttempt.content).toBe('child draft');
    expect(childVersions.items).toHaveLength(1);
  });

  it('does not sync children that already forked into their own content', async () => {
    let { tenant, environment } = await createScope();

    let parent = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Parent',
      content: 'first'
    });

    let child = await cargoClient.document.clone({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: parent.id,
      title: 'Child'
    });

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: child.id,
      content: 'child edit'
    });
    await flushDocument(child.id);

    await db.documentVersion.update({
      where: {
        id: parent.currentVersionId!
      },
      data: {
        createdAt: subtractHours(new Date(), 4)
      }
    });

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: parent.id,
      content: 'second'
    });
    let flushedParent = await flushDocument(parent.id);

    let firstPage = await documentService.listSyncableChildDocumentIdsForVersionSync({
      parentDocumentVersionId: flushedParent!.currentVersion!.id,
      limit: 100
    });
    let childAfterAttempt = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: child.id
    });
    let childRecord = await db.document.findUnique({
      where: {
        id: child.id
      }
    });

    expect(firstPage.childDocumentIds).not.toContain(child.id);
    expect(childRecord?.isContentOwner).toBe(true);
    expect(childAfterAttempt.content).toBe('child edit');
  });

  it('paginates follower children when syncing parent versions', async () => {
    let { tenant, environment } = await createScope();

    let parent = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Parent',
      content: 'first'
    });

    let children = await Promise.all(
      ['Child A', 'Child B', 'Child C'].map(title =>
        cargoClient.document.clone({
          tenantId: tenant.id,
          environmentId: environment.id,
          documentId: parent.id,
          title
        })
      )
    );

    await db.documentVersion.update({
      where: {
        id: parent.currentVersionId!
      },
      data: {
        createdAt: subtractHours(new Date(), 4)
      }
    });

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: parent.id,
      content: 'second'
    });
    let flushedParent = await flushDocument(parent.id);

    let firstPage = await documentService.listSyncableChildDocumentIdsForVersionSync({
      parentDocumentVersionId: flushedParent!.currentVersion!.id,
      limit: 2
    });
    let secondPage = await documentService.listSyncableChildDocumentIdsForVersionSync({
      parentDocumentVersionId: flushedParent!.currentVersion!.id,
      cursor: firstPage.nextCursor,
      limit: 2
    });

    expect(firstPage.childDocumentIds).toHaveLength(2);
    expect(secondPage.childDocumentIds).toHaveLength(1);

    await syncChildVersions(flushedParent!.currentVersion!.id, 2);

    let syncedChildren = await Promise.all(
      children.map(async child => ({
        child,
        document: await cargoClient.document.get({
          tenantId: tenant.id,
          environmentId: environment.id,
          documentId: child.id
        }),
        versions: await cargoClient.documentVersion.list({
          tenantId: tenant.id,
          environmentId: environment.id,
          documentId: child.id,
          limit: 10
        })
      }))
    );

    for (let item of syncedChildren) {
      expect(item.document.content).toBe('second');
      expect(item.versions.items).toHaveLength(2);
    }
  });

  it('cleans up stale versions and orphaned document content', async () => {
    let { tenant, environment } = await createScope();
    let actor = await createActor(tenant.id);

    let created = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Cleanup',
      content: 'first',
      actorId: actor.id
    });

    await db.documentVersion.update({
      where: {
        id: created.currentVersionId!
      },
      data: {
        createdAt: subtractHours(new Date(), 4)
      }
    });

    let updated = await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id,
      content: 'second',
      actorId: actor.id
    });
    await flushDocument(created.id);
    let flushed = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id
    });

    await db.documentVersion.update({
      where: {
        id: created.currentVersionId!
      },
      data: {
        createdAt: subtractDays(new Date(), 31)
      }
    });

    let staleVersions = await documentCleanupService.listStaleDocumentVersions();
    let contentCountBefore = await db.documentContent.count();

    expect(staleVersions.map(version => version.id)).toContain(created.currentVersionId);

    let cleaned = await documentCleanupService.cleanupDocumentVersion({
      documentVersionId: created.currentVersionId!
    });

    let remainingVersions = await cargoClient.documentVersion.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id,
      limit: 10
    });
    let contentCountAfter = await db.documentContent.count();

    expect(cleaned).toBe(true);
    expect(remainingVersions.items).toHaveLength(1);
    expect(remainingVersions.items[0]).toMatchObject({
      id: flushed.currentVersionId,
      previousVersionId: undefined,
      content: 'second',
      listEditedAt: expect.any(Date)
    });
    expect(contentCountAfter).toBe(contentCountBefore - 1);
  });

  it('keeps dirty backstop markers until the latest claimed revision is flushed', async () => {
    let { tenant, environment } = await createScope();
    let actor = await createActor(tenant.id);

    let created = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Dirty Backstop',
      content: 'first',
      actorId: actor.id
    });

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id,
      content: 'second',
      actorId: actor.id
    });

    expect(await documentDraftService.listDirtyDocumentIds()).toContain(created.id);

    let claimedRevision = await documentDraftService.claimDirtyDocumentRevision(created.id);

    expect(claimedRevision).toBe(1);

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id,
      content: 'third',
      actorId: actor.id
    });

    let flushed = await documentService.flushDocumentDraft({
      documentId: created.id,
      force: true,
      queuedRevision: claimedRevision!
    });

    let fetched = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id
    });

    expect(flushed?.id).toBe(created.id);
    expect(fetched.content).toBe('third');
    expect(await documentDraftService.getDraftByDocumentId(created.id)).toBeNull();
    expect(await documentDraftService.listDirtyDocumentIds()).not.toContain(created.id);
    expect(await documentDraftService.claimDirtyDocumentRevision(created.id)).toBeNull();
  });
});
