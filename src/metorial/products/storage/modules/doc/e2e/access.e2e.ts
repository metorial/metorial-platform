import { expectServiceError, firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import type { ResourceAuthorization } from '@metorial/module-access';
import { resourceActorService } from '@metorial/module-resource-actor';
import { storeAccessService } from '@metorial/module-store';
import { describe, expect, it } from 'vitest';
import {
  documentAuthoritativeWriteService,
  documentParticipantService,
  documentService,
  documentVersionService,
  flushDocumentDraft,
  internalDocumentDraftService
} from '../src';
import {
  actorAuthorization,
  cloneDocument,
  createConsumer,
  createDocument,
  createStore,
  editDocument,
  ensureOrganizationResourceActor,
  getDocument,
  privileged,
  scopeOf,
  setStoreAccess
} from './_fixtures';

let permissionsFor = async (
  fixture: OrganizationFixture,
  document: { id: string },
  authorization: ResourceAuthorization
) =>
  await documentService.getDocumentPermissions({
    ...scopeOf(fixture),
    document: await getDocument(fixture, document.id),
    authorization
  });

let listIds = async (
  fixture: OrganizationFixture,
  authorization: ResourceAuthorization,
  ids: string[]
) =>
  (
    await firstPage(
      await documentService.listDocuments({ ...scopeOf(fixture), authorization, ids })
    )
  ).map(item => item.id);

let participantOf = async (document: { oid: bigint }, actor: { oid: bigint }) =>
  await db.documentParticipant.findUnique({
    where: {
      documentOid_resourceActorOid: { documentOid: document.oid, resourceActorOid: actor.oid }
    }
  });

describe('module-documents access', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('keeps consumers away from documents in private stores', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let consumer = await createConsumer(fixture);
    let store = await createStore(fixture, 'private');
    let content = '# Private\n\nNot for consumers';
    let document = await createDocument(fixture, { store, content });
    let resolved = await getDocument(fixture, document.id);
    let scope = { ...scopeOf(fixture), authorization: consumer.authorization };

    await expectServiceError(
      getDocument(fixture, document.id, consumer.authorization),
      'forbidden'
    );
    await expectServiceError(
      editDocument(fixture, document, {
        content: 'consumer edit',
        authorization: consumer.authorization
      }),
      'forbidden'
    );
    await expectServiceError(
      documentAuthoritativeWriteService.applyDocumentContent({
        ...scopeOf(fixture),
        document: resolved,
        input: {
          title: 'Taken',
          content: 'consumer write',
          authorization: consumer.authorization
        }
      }),
      'forbidden'
    );
    await expectServiceError(
      documentService.deleteDocument({
        ...scope,
        auditScope: fixture.auditScope,
        document: resolved
      }),
      'forbidden'
    );
    await expectServiceError(
      cloneDocument(fixture, resolved, { authorization: consumer.authorization }),
      'forbidden'
    );
    await expectServiceError(
      documentVersionService.listDocumentVersions({ ...scope, documentId: document.id }),
      'forbidden'
    );
    await expectServiceError(
      documentVersionService.getDocumentVersionById({
        ...scope,
        documentVersionId: document.currentVersion!.id
      }),
      'forbidden'
    );
    await expectServiceError(
      documentParticipantService.listDocumentParticipants({
        ...scope,
        documentId: document.id
      }),
      'forbidden'
    );

    expect(await listIds(fixture, consumer.authorization, [document.id])).toEqual([]);
    expect(
      await firstPage(await documentService.listDocuments({ ...scope, storeIds: [store.id] }))
    ).toEqual([]);
    expect(await permissionsFor(fixture, document, consumer.authorization)).toMatchObject({
      isOwner: false,
      hasFullAccess: false,
      permissions: []
    });

    let row = await db.document.findUniqueOrThrow({
      where: { id: document.id },
      include: { content: true, file: true }
    });
    expect(row.content.content).toBe(content);
    expect(row.file.status).toBe('active');
    expect(await internalDocumentDraftService.getDraftByDocumentId(document.id)).toBeNull();
    expect(await participantOf(document, consumer.actor)).toBeNull();
    expect(await db.document.count({ where: { parentDocumentOid: document.oid } })).toBe(0);
  });

  it('lets consumers read but not edit documents in public_read stores', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let consumer = await createConsumer(fixture);
    let store = await createStore(fixture, 'public_read');
    let document = await createDocument(fixture, { store });

    let read = await getDocument(fixture, document.id, consumer.authorization);
    expect(read.id).toBe(document.id);

    let participant = await participantOf(document, consumer.actor);
    expect(participant).toMatchObject({ role: 'viewer', editCount: 0, lastEditedAt: null });
    expect(participant!.lastViewedAt).not.toBeNull();

    let storeParticipant = await db.storeParticipantActor.findUniqueOrThrow({
      where: {
        storeOid_resourceActorOid: {
          storeOid: store.oid,
          resourceActorOid: consumer.actor.oid
        }
      }
    });
    expect(storeParticipant.permissions).toEqual([]);

    await expectServiceError(
      editDocument(fixture, document, {
        content: 'consumer edit',
        authorization: consumer.authorization
      }),
      'forbidden'
    );
    expect(await internalDocumentDraftService.getDraftByDocumentId(document.id)).toBeNull();

    expect(await permissionsFor(fixture, document, consumer.authorization)).toMatchObject({
      hasFullAccess: false,
      permissions: ['content_read'],
      readableStoreIds: [store.id],
      writableStoreIds: []
    });
    expect(await listIds(fixture, consumer.authorization, [document.id])).toEqual([
      document.id
    ]);

    let versions = await firstPage(
      await documentVersionService.listDocumentVersions({
        ...scopeOf(fixture),
        documentId: document.id,
        authorization: consumer.authorization
      })
    );
    expect(versions.map(version => version.id)).toEqual([document.currentVersion!.id]);

    let copy = await cloneDocument(fixture, read, {
      cloneType: 'duplicate',
      authorization: consumer.authorization
    });
    expect(copy.createdByResourceActorOid).toBe(consumer.actor.oid);
    expect(
      (
        await editDocument(fixture, copy, {
          content: 'mine',
          authorization: consumer.authorization
        })
      ).resolvedContent
    ).toBe('mine');
  });

  it('lets consumers edit documents in public_write stores and records them as editors', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let consumer = await createConsumer(fixture);
    let store = await createStore(fixture, 'public_write');
    let document = await createDocument(fixture, { store });

    await editDocument(fixture, document, {
      content: '# Consumer\n\nEdited',
      authorization: consumer.authorization
    });
    await flushDocumentDraft({ documentId: document.id, force: true });

    let row = await db.document.findUniqueOrThrow({
      where: { id: document.id },
      include: { content: true }
    });
    expect(row.content.content).toBe('# Consumer\n\nEdited');

    expect(await participantOf(document, consumer.actor)).toMatchObject({
      role: 'editor',
      editCount: 1
    });
    let editors = await db.documentVersionEditors.findMany({
      where: { documentVersionOid: row.currentVersionOid! }
    });
    expect(editors.map(editor => editor.resourceActorOid)).toEqual([consumer.actor.oid]);

    expect(await permissionsFor(fixture, document, consumer.authorization)).toMatchObject({
      hasFullAccess: true,
      permissions: ['content_read', 'content_write']
    });

    let deleteError = await expectServiceError(
      documentService.deleteDocument({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        authorization: consumer.authorization,
        document: await getDocument(fixture, document.id)
      }),
      'bad_request'
    );
    expect(deleteError.message).toMatch(/active references/);
  });

  it('gives the creating consumer full access and nobody else', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let owner = await createConsumer(fixture);
    let bystander = await createConsumer(fixture);
    let document = await createDocument(fixture, { authorization: owner.authorization });
    expect(document.createdByResourceActorOid).toBe(owner.actor.oid);

    expect((await getDocument(fixture, document.id, owner.authorization)).id).toBe(
      document.id
    );
    expect(await permissionsFor(fixture, document, owner.authorization)).toMatchObject({
      isOwner: true,
      hasFullAccess: true
    });
    expect(await listIds(fixture, owner.authorization, [document.id])).toEqual([document.id]);

    await expectServiceError(
      getDocument(fixture, document.id, bystander.authorization),
      'forbidden'
    );
    await expectServiceError(
      editDocument(fixture, document, {
        content: 'hijack',
        authorization: bystander.authorization
      }),
      'forbidden'
    );
    expect(await listIds(fixture, bystander.authorization, [document.id])).toEqual([]);
    await expectServiceError(
      documentService.deleteDocument({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        authorization: bystander.authorization,
        document: await getDocument(fixture, document.id)
      }),
      'forbidden'
    );

    let edited = await editDocument(fixture, document, {
      content: 'owner edit',
      authorization: owner.authorization
    });
    expect(edited.resolvedContent).toBe('owner edit');

    let deleted = await documentService.deleteDocument({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      authorization: owner.authorization,
      document: await getDocument(fixture, document.id)
    });
    expect(deleted.file.status).toBe('deleted');
  });

  it('stops serving a consumer once a public store becomes private', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let consumer = await createConsumer(fixture);
    let store = await createStore(fixture, 'public_read');
    let document = await createDocument(fixture, { store });
    await getDocument(fixture, document.id, consumer.authorization);

    await setStoreAccess(store, 'private');

    await expectServiceError(
      getDocument(fixture, document.id, consumer.authorization),
      'forbidden'
    );
  });

  it('lists participants with their roles and hides system actors', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let creator = await ensureOrganizationResourceActor(fixture);
    let viewer = await createConsumer(fixture);
    let storeEditor = await createConsumer(fixture);
    let systemActor = await resourceActorService.upsertActor({
      project: fixture.project,
      input: { identifier: uniqueId('e2e-system'), type: 'system', name: 'E2E system' }
    });
    let store = await createStore(fixture, 'public_read');
    let document = await createDocument(fixture, {
      store,
      authorization: actorAuthorization(creator)
    });

    await getDocument(fixture, document.id, viewer.authorization);
    await getDocument(fixture, document.id, actorAuthorization(systemActor));
    await storeAccessService.ensureActorStorePermissions({
      store,
      actor: storeEditor.actor,
      permissions: ['content_read', 'content_write']
    });
    expect(await participantOf(document, systemActor)).not.toBeNull();
    expect(await participantOf(document, storeEditor.actor)).toBeNull();

    let participants = await firstPage(
      await documentParticipantService.listDocumentParticipants({
        ...scopeOf(fixture),
        documentId: document.id,
        authorization: privileged
      })
    );
    let roles = Object.fromEntries(
      participants.map(participant => [participant.resourceActor.id, participant.role])
    );
    expect(roles).toEqual({
      [creator.id]: 'editor',
      [viewer.actor.id]: 'viewer',
      [storeEditor.actor.id]: 'editor'
    });

    let filtered = await firstPage(
      await documentParticipantService.listDocumentParticipants({
        ...scopeOf(fixture),
        documentId: document.id,
        actorIds: [viewer.actor.id],
        authorization: viewer.authorization
      })
    );
    expect(filtered.map(participant => participant.resourceActor.id)).toEqual([
      viewer.actor.id
    ]);

    let creatorParticipant = participants.find(item => item.resourceActor.id === creator.id)!;
    let fetched = await documentParticipantService.getDocumentParticipantById({
      ...scopeOf(fixture),
      documentParticipantId: creatorParticipant.id,
      authorization: privileged
    });
    expect(fetched.document.id).toBe(document.id);

    let systemParticipant = await participantOf(document, systemActor);
    await expectServiceError(
      documentParticipantService.getDocumentParticipantById({
        ...scopeOf(fixture),
        documentParticipantId: systemParticipant!.id,
        authorization: privileged
      }),
      'not_found'
    );
    await expectServiceError(
      documentParticipantService.getDocumentParticipantById({
        ...scopeOf(other),
        documentParticipantId: creatorParticipant.id,
        authorization: privileged
      }),
      'not_found'
    );
  });
});
