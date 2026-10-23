import { eventually, expectServiceError, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import type { ResourceAuthorization } from '@metorial/module-access';
import { describe, expect, it } from 'vitest';
import {
  documentAuthoritativeWriteService,
  flushDocumentCollaborationState,
  internalDocumentCollaborationService,
  internalDocumentDraftService
} from '../src';
import { subscribeToDocumentLiveBus } from '../src/live/documentLiveBus';
import type { DocumentLiveBusMessage } from '../src/live/documentLiveBusProtocol';
import {
  actorAuthorization,
  createDocument,
  editDocument,
  ensureOrganizationResourceActor,
  getDocument,
  privileged,
  scopeOf,
  yjsUpdate
} from './_fixtures';

let applyContent = async (
  fixture: OrganizationFixture,
  document: { id: string },
  input: { title: string; content: string; authorization?: ResourceAuthorization }
) =>
  await documentAuthoritativeWriteService.applyDocumentContent({
    ...scopeOf(fixture),
    document: await getDocument(fixture, document.id),
    input: {
      title: input.title,
      content: input.content,
      authorization: input.authorization ?? privileged
    }
  });

let revisionOf = (result: { revision?: number }) => result.revision ?? 0;

let readContent = async (document: { id: string }) =>
  await db.document.findUniqueOrThrow({
    where: { id: document.id },
    include: { content: true, currentVersion: true }
  });

describe('module-documents collaboration', () => {
  let org = useOrganization();

  it('flushes merged collaborative state into the document as markdown', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let actor = await ensureOrganizationResourceActor(fixture);
    let document = await createDocument(fixture, {
      title: 'Before',
      content: '# Before\n\nOld body'
    });

    let merged = await internalDocumentCollaborationService.mergeUpdate({
      documentId: document.id,
      update: yjsUpdate({ paragraphs: ['Written together'], title: 'Together' }),
      actorId: actor.id,
      actorContext: fixture.context,
      generation: 0
    });
    expect(merged).toMatchObject({ stale: false, generation: 0 });
    expect(revisionOf(merged)).toBeGreaterThanOrEqual(1);

    await flushDocumentCollaborationState({ documentId: document.id });

    let row = await eventually(async () => {
      let row = await readContent(document);
      expect(row.content.content).toBe('# Together\n\nWritten together');
      return row;
    });
    expect(row.title).toBe('Together');
    expect(await internalDocumentDraftService.getDraftByDocumentId(document.id)).toBeNull();

    let editors = await db.documentVersionEditors.findMany({
      where: { documentVersionOid: row.currentVersion!.oid }
    });
    expect(editors.map(editor => editor.resourceActorOid)).toContain(actor.oid);

    let participant = await db.documentParticipant.findUniqueOrThrow({
      where: {
        documentOid_resourceActorOid: { documentOid: row.oid, resourceActorOid: actor.oid }
      }
    });
    expect(participant.role).toBe('editor');
  });

  it('merges concurrent updates of the same generation', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let document = await createDocument(fixture);

    let first = await internalDocumentCollaborationService.mergeUpdate({
      documentId: document.id,
      update: yjsUpdate({ paragraphs: ['From Alice'] }),
      generation: 0
    });
    let second = await internalDocumentCollaborationService.mergeUpdate({
      documentId: document.id,
      update: yjsUpdate({ paragraphs: ['From Bob'] }),
      generation: 0
    });
    expect(first.stale).toBe(false);
    expect(second.stale).toBe(false);
    expect(revisionOf(second)).toBeGreaterThan(revisionOf(first));

    await flushDocumentCollaborationState({ documentId: document.id });

    await eventually(async () => {
      let row = await readContent(document);
      expect(row.content.content).toContain('From Alice');
      expect(row.content.content).toContain('From Bob');
    });
  });

  it('writes authoritative content immediately, over a pending draft', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let document = await createDocument(fixture, { content: 'original' });
    await editDocument(fixture, document, { content: 'pending draft' });

    let written = await applyContent(fixture, document, {
      title: 'Authoritative',
      content: '# Authoritative\n\nFinal'
    });
    expect(written.hasDraft).toBeFalsy();
    expect(written.title).toBe('Authoritative');
    expect(written.content.content).toBe('# Authoritative\n\nFinal');

    let row = await readContent(document);
    expect(row.title).toBe('Authoritative');
    expect(row.content.content).toBe('# Authoritative\n\nFinal');
    expect(await internalDocumentDraftService.getDraftByDocumentId(document.id)).toBeNull();
  });

  it('resets collaboration on an authoritative write and rejects updates from the old generation', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let document = await createDocument(fixture);
    let messages: DocumentLiveBusMessage[] = [];
    await subscribeToDocumentLiveBus(message => {
      if (message.documentId === document.id) messages.push(message);
    });

    await internalDocumentCollaborationService.mergeUpdate({
      documentId: document.id,
      update: yjsUpdate({ paragraphs: ['Collaborative edit in flight'] }),
      generation: 0
    });
    expect(
      await internalDocumentCollaborationService.getStateUpdate(document.id)
    ).not.toBeNull();

    await applyContent(fixture, document, {
      title: 'Reset',
      content: '# Reset\n\nAuthoritative body'
    });

    expect(await internalDocumentCollaborationService.getSnapshot(document.id)).toEqual({
      update: null,
      generation: 1
    });

    let reset = await eventually(() => {
      let message = messages.find(item => item.type === 'collaboration_reset');
      expect(message).toBeDefined();
      return message!;
    });
    expect(reset.data).toEqual({ stateUpdate: null, generation: 1 });
    expect(reset.deliverToOriginInstance).toBe(true);

    let stale = await internalDocumentCollaborationService.mergeUpdate({
      documentId: document.id,
      update: yjsUpdate({ paragraphs: ['Late edit from the old generation'] }),
      generation: 0
    });
    expect(stale).toEqual({ stale: true, update: null, generation: 1 });
    expect(await internalDocumentCollaborationService.getStateUpdate(document.id)).toBeNull();

    let staleInit = await internalDocumentCollaborationService.initializeState({
      documentId: document.id,
      update: yjsUpdate({ paragraphs: ['Stale initial state'] }),
      generation: 0
    });
    expect(staleInit).toMatchObject({ initialized: false, stale: true, generation: 1 });

    expect(await flushDocumentCollaborationState({ documentId: document.id })).toBeNull();
    expect((await readContent(document)).content.content).toBe(
      '# Reset\n\nAuthoritative body'
    );

    let current = await internalDocumentCollaborationService.mergeUpdate({
      documentId: document.id,
      update: yjsUpdate({ paragraphs: ['Edit on the new generation'] }),
      generation: 1
    });
    expect(current).toMatchObject({ stale: false, generation: 1 });
  });

  it('initializes collaboration state only once per generation', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let document = await createDocument(fixture);
    let initial = yjsUpdate({ paragraphs: ['Initial state'] });

    let first = await internalDocumentCollaborationService.initializeState({
      documentId: document.id,
      update: initial,
      generation: 0
    });
    expect(first).toMatchObject({ initialized: true, stale: false, generation: 0 });

    let second = await internalDocumentCollaborationService.initializeState({
      documentId: document.id,
      update: yjsUpdate({ paragraphs: ['Competing state'] }),
      generation: 0
    });
    expect(second).toMatchObject({ initialized: false, stale: false, update: first.update });
  });

  it('refuses authoritative writes to read-only documents and drops their collaborative edits', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let content = '# Locked\n\nRead only';
    let document = await createDocument(fixture, { content, readOnly: true });

    await expectServiceError(
      applyContent(fixture, document, { title: 'Changed', content: 'changed' }),
      'forbidden'
    );

    await internalDocumentCollaborationService.mergeUpdate({
      documentId: document.id,
      update: yjsUpdate({ paragraphs: ['Not allowed'] }),
      generation: 0
    });
    await flushDocumentCollaborationState({ documentId: document.id });

    await eventually(async () => {
      expect(await internalDocumentCollaborationService.getSnapshot(document.id)).toEqual({
        update: null,
        generation: 1
      });
    });
    let row = await readContent(document);
    expect(row.content.content).toBe(content);
    expect(row.title).not.toBe('Changed');
  });

  it('attributes authoritative writes to the acting resource actor', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let actor = await ensureOrganizationResourceActor(fixture);
    let document = await createDocument(fixture);

    await applyContent(fixture, document, {
      title: 'Attributed',
      content: '# Attributed\n\nBody',
      authorization: actorAuthorization(actor)
    });

    let row = await readContent(document);
    let editors = await db.documentVersionEditors.findMany({
      where: { documentVersionOid: row.currentVersion!.oid }
    });
    expect(editors.map(editor => editor.resourceActorOid)).toEqual([actor.oid]);

    let participant = await db.documentParticipant.findUniqueOrThrow({
      where: {
        documentOid_resourceActorOid: { documentOid: row.oid, resourceActorOid: actor.oid }
      }
    });
    expect(participant).toMatchObject({ role: 'editor', editCount: 1 });
  });
});
