import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { expectServiceError, firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { describe, expect, it } from 'vitest';
import {
  documentParticipantService,
  documentService,
  documentVersionService,
  flushDocumentDraft,
  internalDocumentDraftService,
  internalDocumentSyncService
} from '../src';
import {
  actorAuthorization,
  byteSize,
  captureFabric,
  cloneDocument,
  createDocument,
  createStore,
  editAndFlush,
  editDocument,
  effectiveStoreIdOf,
  ensureOrganizationResourceActor,
  getDocument,
  privileged,
  scopeOf
} from './_fixtures';

let hours = (count: number) => count * 60 * 60 * 1000;

describe('module-documents documents', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let vetoOrg = useOrganization();

  it('persists a created document with its file, content, first version and creator', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let actor = await ensureOrganizationResourceActor(fixture);
    let title = uniqueId('Café notes');
    let content = `# ${title}\n\nGrüße aus dem e2e`;

    let document = await createDocument(fixture, {
      title,
      content,
      authorization: actorAuthorization(actor)
    });

    let row = await db.document.findUniqueOrThrow({
      where: { id: document.id },
      include: { content: true, file: true, currentVersion: true }
    });
    expect(row).toMatchObject({
      title,
      isContentOwner: true,
      isReadOnly: false,
      isTemplateBacking: false,
      maxVersionNumber: 1,
      parentDocumentOid: null,
      draftVersionExpiresAt: null,
      createdByResourceActorOid: actor.oid,
      projectOid: fixture.project.oid,
      instanceOid: fixture.instance.oid
    });
    expect(row.content.content).toBe(content);
    expect(row.file).toMatchObject({
      status: 'active',
      fileType: 'text/markdown',
      fileName: title,
      title,
      fileSize: byteSize(content),
      storeId: `document_${document.id}`
    });

    let versions = await db.documentVersion.findMany({ where: { documentOid: row.oid } });
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({
      versionNumber: 1,
      contentOid: row.contentOid,
      previousVersionOid: null,
      projectOid: fixture.project.oid,
      instanceOid: fixture.instance.oid
    });
    expect(row.currentVersion?.oid).toBe(versions[0]!.oid);

    let participant = await db.documentParticipant.findUniqueOrThrow({
      where: {
        documentOid_resourceActorOid: { documentOid: row.oid, resourceActorOid: actor.oid }
      }
    });
    expect(participant).toMatchObject({ role: 'editor', editCount: 1 });
    expect(participant.lastEditedAt).not.toBeNull();

    let editors = await db.documentVersionEditors.findMany({
      where: { documentVersionOid: versions[0]!.oid }
    });
    expect(editors).toEqual([
      expect.objectContaining({
        resourceActorOid: actor.oid,
        ip: fixture.context.ip,
        ua: fixture.context.ua
      })
    ]);
  });

  it('keeps edits in a draft until the draft is flushed', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let original = '# Original\n\nUntouched';
    let document = await createDocument(fixture, { title: 'Original', content: original });

    let first = await editDocument(fixture, document, {
      title: 'Edited',
      content: '# Edited\n\nFirst edit'
    });
    expect(first).toMatchObject({
      hasDraft: true,
      draftRevision: 1,
      resolvedTitle: 'Edited',
      resolvedContent: '# Edited\n\nFirst edit'
    });

    let second = await editDocument(fixture, document, { content: '# Edited\n\nSecond edit' });
    expect(second).toMatchObject({
      draftRevision: 2,
      resolvedTitle: 'Edited',
      resolvedContent: '# Edited\n\nSecond edit'
    });

    let draft = await internalDocumentDraftService.getDraftByDocumentId(document.id);
    expect(draft).toMatchObject({ revision: 2, title: 'Edited' });

    let beforeFlush = await db.document.findUniqueOrThrow({
      where: { id: document.id },
      include: { content: true }
    });
    expect(beforeFlush.title).toBe('Original');
    expect(beforeFlush.content.content).toBe(original);

    let fetched = await getDocument(fixture, document.id);
    expect(fetched.resolvedContent).toBe('# Edited\n\nSecond edit');
    expect(fetched.content.content).toBe(original);

    let flushedAt = Date.now();
    let flushed = await flushDocumentDraft({ documentId: document.id, force: true });
    expect(flushed?.title).toBe('Edited');
    expect(await internalDocumentDraftService.getDraftByDocumentId(document.id)).toBeNull();

    let row = await db.document.findUniqueOrThrow({
      where: { id: document.id },
      include: { content: true, file: true }
    });
    expect(row.title).toBe('Edited');
    expect(row.content.content).toBe('# Edited\n\nSecond edit');
    expect(row.file).toMatchObject({
      fileName: 'Edited',
      title: 'Edited',
      fileSize: byteSize('# Edited\n\nSecond edit')
    });
    expect(row.draftVersionExpiresAt!.getTime()).toBeGreaterThan(flushedAt + hours(2.9));
    expect(row.draftVersionExpiresAt!.getTime()).toBeLessThan(Date.now() + hours(3.1));

    let resolved = await getDocument(fixture, document.id);
    expect(resolved.hasDraft).toBeFalsy();
    expect(resolved.resolvedContent).toBeUndefined();
    expect(resolved.content.content).toBe('# Edited\n\nSecond edit');

    expect(await flushDocumentDraft({ documentId: document.id, force: true })).toBeNull();
  });

  it('round-trips large and multi-byte content byte for byte', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let content = [
      '---\nowner: e2e\n---',
      '# Ünïcödé 文档 🚀',
      'Tabs\tand\r\nwindows line endings',
      'x'.repeat(200_000)
    ].join('\n\n');

    let document = await createDocument(fixture, { content });
    expect((await getDocument(fixture, document.id)).content.content).toBe(content);

    let edited = `${content}\n\nappended ✅`;
    let flushed = await editAndFlush(fixture, document, { content: edited });
    expect(flushed.content.content).toBe(edited);

    let file = await db.file.findUniqueOrThrow({ where: { oid: document.fileOid } });
    expect(file.fileSize).toBe(byteSize(edited));
  });

  it('rejects updates without fields and blank titles on create', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let document = await createDocument(fixture);

    await expectServiceError(
      documentService.updateDocument({
        ...scopeOf(fixture),
        document: await getDocument(fixture, document.id),
        input: { authorization: privileged }
      }),
      'bad_request'
    );
    expect(await internalDocumentDraftService.getDraftByDocumentId(document.id)).toBeNull();

    let id = await ID.generateId('document');
    await expectServiceError(createDocument(fixture, { id, title: '   ' }), 'bad_request');
    expect(await db.document.findUnique({ where: { id } })).toBeNull();
  });

  it('rejects writes to read-only documents', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let content = '# Locked\n\nRead only';
    let document = await createDocument(fixture, { content, readOnly: true });
    let resolved = await getDocument(fixture, document.id);

    await expectServiceError(
      documentService.updateDocument({
        ...scopeOf(fixture),
        document: resolved,
        input: { content: 'changed', authorization: privileged }
      }),
      'forbidden'
    );
    await expectServiceError(
      documentService.deleteDocument({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        authorization: privileged,
        document: resolved
      }),
      'forbidden'
    );

    let permissions = await documentService.getDocumentPermissions({
      ...scopeOf(fixture),
      document: resolved,
      authorization: privileged
    });
    expect(permissions).toMatchObject({ hasFullAccess: false, permissions: ['content_read'] });

    let row = await db.document.findUniqueOrThrow({
      where: { id: document.id },
      include: { content: true, file: true }
    });
    expect(row.content.content).toBe(content);
    expect(row.file.status).toBe('active');
    expect(await internalDocumentDraftService.getDraftByDocumentId(document.id)).toBeNull();
  });

  it('deletes a document, drops its draft and hides it from every read', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let document = await createDocument(fixture);
    await editDocument(fixture, document, { content: 'pending draft' });
    let resolved = await getDocument(fixture, document.id);
    let deletedEvents = captureFabric('document.deleted:after');

    let deleted = await documentService
      .deleteDocument({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        authorization: privileged,
        document: resolved
      })
      .finally(deletedEvents.stop);

    expect(deleted.file.status).toBe('deleted');
    expect(await internalDocumentDraftService.getDraftByDocumentId(document.id)).toBeNull();
    expect(deletedEvents.events.map(event => event.document.id)).toEqual([document.id]);
    expect(deletedEvents.events[0]!.auditScope).toBe(fixture.auditScope);

    await expectServiceError(getDocument(fixture, document.id), 'not_found');
    let includingDeleted = await documentService.getDocumentById({
      ...scopeOf(fixture),
      documentId: document.id,
      includeDeleted: true,
      authorization: privileged
    });
    expect(includingDeleted.file.status).toBe('deleted');

    expect(
      await firstPage(
        await documentService.listDocuments({
          ...scopeOf(fixture),
          authorization: privileged,
          ids: [document.id]
        })
      )
    ).toEqual([]);
    await expectServiceError(
      documentVersionService.listDocumentVersions({
        ...scopeOf(fixture),
        documentId: document.id,
        authorization: privileged
      }),
      'not_found'
    );
    await expectServiceError(
      documentVersionService.getDocumentVersionById({
        ...scopeOf(fixture),
        documentVersionId: document.currentVersion!.id,
        authorization: privileged
      }),
      'not_found'
    );
    await expectServiceError(
      documentParticipantService.listDocumentParticipants({
        ...scopeOf(fixture),
        documentId: document.id,
        authorization: privileged
      }),
      'not_found'
    );

    await expectServiceError(
      documentService.deleteDocument({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        authorization: privileged,
        document: deleted
      }),
      'forbidden'
    );
    await expectServiceError(
      documentService.updateDocument({
        ...scopeOf(fixture),
        document: deleted,
        input: { content: 'after delete', authorization: privileged }
      }),
      'forbidden'
    );
  });

  it('fires creation events and lets a before hook veto the creation', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let before = captureFabric('document.created:before');
    let after = captureFabric('document.created:after');

    let document = await createDocument(fixture).finally(() => {
      before.stop();
      after.stop();
    });

    expect(after.events.map(event => event.document.id)).toEqual([document.id]);
    expect(after.events[0]).toMatchObject({
      instance: { oid: fixture.instance.oid },
      auditScope: fixture.auditScope,
      document: { currentVersion: { id: document.currentVersion!.id } }
    });
    expect(before.events.map(event => event.instance.oid)).toContain(fixture.instance.oid);

    let vetoFixture = await loadOrganizationFixture(vetoOrg.ids);
    let stopVeto = Fabric.listen('document.created:before', event => {
      if (event.instance.oid !== vetoFixture.instance.oid) return;
      throw new ServiceError(forbiddenError({ message: 'Document quota exceeded' }));
    });

    let id = await ID.generateId('document');
    let vetoed = await expectServiceError(
      createDocument(vetoFixture, { id }).finally(stopVeto),
      'forbidden'
    );
    expect(vetoed.message).toBe('Document quota exceeded');
    expect(await db.document.findUnique({ where: { id } })).toBeNull();
  });

  it('lists documents by ids, store, creator and parent, without template backings', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let actor = await ensureOrganizationResourceActor(fixture);
    let store = await createStore(fixture);
    let inStore = await createDocument(fixture, { store });
    let byActor = await createDocument(fixture, { authorization: actorAuthorization(actor) });
    let backing = await createDocument(fixture, { templateBacking: true });
    let child = await cloneDocument(fixture, await getDocument(fixture, inStore.id));

    let list = async (filters: Parameters<typeof documentService.listDocuments>[0]) =>
      (await firstPage(await documentService.listDocuments(filters))).map(item => item.id);
    let base = { ...scopeOf(fixture), authorization: privileged };

    expect(await list({ ...base, ids: [inStore.id, byActor.id, backing.id] })).toEqual(
      expect.arrayContaining([inStore.id, byActor.id])
    );
    expect(await list({ ...base, ids: [backing.id] })).toEqual([]);
    expect(await list({ ...base, ids: [] })).toEqual([]);
    expect(await list({ ...base, storeIds: [store.id] })).toEqual([inStore.id]);
    expect(await list({ ...base, parentDocumentIds: [inStore.id] })).toEqual([child.id]);
    expect(
      await list({ ...base, createdByActorIds: [actor.id], ids: [inStore.id, byActor.id] })
    ).toEqual([byActor.id]);
    expect(
      await list({
        ...base,
        ids: [inStore.id, byActor.id],
        createdAt: { gt: new Date(Date.now() + hours(1)) }
      })
    ).toEqual([]);

    let page = await (
      await documentService.listDocuments({ ...base, ids: [inStore.id, byActor.id] })
    ).run({ limit: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.pagination.hasNextPage).toBe(true);
  });

  it('isolates documents, versions and participants between tenants', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let store = await createStore(fixture);
    let document = await createDocument(fixture, { store });
    let otherScope = { ...scopeOf(other), authorization: privileged };

    await expectServiceError(getDocument(other, document.id), 'not_found');
    expect(
      await firstPage(
        await documentService.listDocuments({ ...otherScope, ids: [document.id] })
      )
    ).toEqual([]);
    expect(
      (await firstPage(await documentService.listDocuments(otherScope))).map(item => item.id)
    ).not.toContain(document.id);
    expect(
      await firstPage(
        await documentService.listDocuments({ ...otherScope, storeIds: [store.id] })
      )
    ).toEqual([]);

    await expectServiceError(
      documentVersionService.getDocumentVersionById({
        ...otherScope,
        documentVersionId: document.currentVersion!.id
      }),
      'not_found'
    );
    await expectServiceError(
      documentVersionService.listDocumentVersions({ ...otherScope, documentId: document.id }),
      'not_found'
    );
    await expectServiceError(
      documentParticipantService.listDocumentParticipants({
        ...otherScope,
        documentId: document.id
      }),
      'not_found'
    );

    await expectServiceError(createDocument(other, { store }), 'not_found');
    expect(
      await db.storeItem.count({ where: { store: { id: store.id }, kind: 'document' } })
    ).toBe(1);
  });

  it('rejects an authorization whose actor belongs to another project', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let otherActor = await ensureOrganizationResourceActor(other);
    let document = await createDocument(fixture);

    await expectServiceError(
      getDocument(fixture, document.id, actorAuthorization(otherActor)),
      'bad_request'
    );
    await expectServiceError(
      editDocument(fixture, document, {
        content: 'cross project',
        authorization: actorAuthorization(otherActor)
      }),
      'bad_request'
    );
    expect(await internalDocumentDraftService.getDraftByDocumentId(document.id)).toBeNull();
    expect(
      await db.documentParticipant.count({
        where: { document: { id: document.id }, resourceActorOid: otherActor.oid }
      })
    ).toBe(0);
  });

  it('clones a document as a synced child that shares the parent content', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let content = '# Parent\n\nShared body';
    let parent = await createDocument(fixture, { title: 'Parent', content });

    let child = await cloneDocument(fixture, await getDocument(fixture, parent.id), {
      title: 'Child'
    });
    expect(child).toMatchObject({
      title: 'Child',
      isContentOwner: false,
      parentDocumentOid: parent.oid,
      contentOid: parent.contentOid,
      maxVersionNumber: 1
    });
    expect(child.content.content).toBe(content);
    expect(child.currentVersion?.contentOid).toBe(parent.contentOid);
    expect(child.file.storeId).toBe(`document_${child.id}`);
    expect(effectiveStoreIdOf(child)).toBe(parent.file.storeId);

    let fetched = await getDocument(fixture, child.id);
    expect(fetched.parentDocument?.id).toBe(parent.id);
    expect(effectiveStoreIdOf(fetched)).toBe(parent.file.storeId);
  });

  it('detaches a synced child from its parent once the child is edited', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let content = '# Parent\n\nShared body';
    let parent = await createDocument(fixture, { content });
    let child = await cloneDocument(fixture, await getDocument(fixture, parent.id));

    let edited = await editAndFlush(fixture, child, { content: '# Child\n\nDiverged' });
    expect(edited.isContentOwner).toBe(true);
    expect(edited.contentOid).not.toBe(parent.contentOid);
    expect(edited.content.content).toBe('# Child\n\nDiverged');
    expect(effectiveStoreIdOf(edited)).toBeUndefined();

    let parentRow = await db.document.findUniqueOrThrow({
      where: { id: parent.id },
      include: { content: true }
    });
    expect(parentRow.content.content).toBe(content);

    let syncable =
      await internalDocumentSyncService.listSyncableChildDocumentIdsForVersionSync({
        parentDocumentVersionId: parent.currentVersion!.id,
        limit: 100
      });
    expect(syncable.childDocumentIds).not.toContain(child.id);
  });

  it('duplicates a document with its own content and a rewritten title', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let parent = await createDocument(fixture, {
      title: 'Source',
      content: '---\nkind: guide\n---\n\n# Source\n\nBody text'
    });

    let duplicate = await cloneDocument(fixture, await getDocument(fixture, parent.id), {
      cloneType: 'duplicate',
      title: 'Copy',
      rewriteContentTitle: true
    });
    expect(duplicate).toMatchObject({
      title: 'Copy',
      isContentOwner: true,
      parentDocumentOid: null
    });
    expect(duplicate.contentOid).not.toBe(parent.contentOid);
    expect(duplicate.content.content).toBe('---\nkind: guide\n---\n\n# Copy\n\nBody text');

    await editAndFlush(fixture, parent, { content: '# Source\n\nChanged later' });
    let row = await db.document.findUniqueOrThrow({
      where: { id: duplicate.id },
      include: { content: true }
    });
    expect(row.content.content).toBe('---\nkind: guide\n---\n\n# Copy\n\nBody text');
  });

  it('rejects title rewrites for synced clones and clones of deleted documents', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let parent = await createDocument(fixture);
    let resolved = await getDocument(fixture, parent.id);

    await expectServiceError(
      cloneDocument(fixture, resolved, {
        cloneType: 'sync_until_change',
        rewriteContentTitle: true
      }),
      'bad_request'
    );
    expect(await db.document.count({ where: { parentDocumentOid: parent.oid } })).toBe(0);

    let deleted = await documentService.deleteDocument({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      authorization: privileged,
      document: resolved
    });
    await expectServiceError(cloneDocument(fixture, deleted), 'forbidden');
  });
});
