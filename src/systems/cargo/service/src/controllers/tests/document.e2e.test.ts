import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db';
import { documentCleanupService, documentService } from '../../services';
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

let createActor = async (tenantId: string) =>
  await cargoClient.actor.upsert({
    tenantId,
    identifier: 'actor-1',
    name: 'Actor One'
  });

let flushDocument = async (documentId: string) =>
  await documentService.flushDocumentDraft({
    documentId,
    force: true
  });

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

  it('upserts viewer participants on get and promotes them on edit', async () => {
    let { tenant, environment } = await createScope();
    let viewer = await cargoClient.actor.upsert({
      tenantId: tenant.id,
      identifier: 'viewer-1',
      name: 'Viewer One'
    });

    let created = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Viewed',
      content: 'hello world'
    });

    await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id,
      actorId: viewer.id
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
      actorId: viewer.id
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

    expect(cloneBeforeWrite?.isContentOwner).toBe(false);
    expect(sourceBeforeWrite?.contentOid).toBe(cloneBeforeWrite?.contentOid);
    expect(updatedClone.currentVersionId).toBe(cloned.currentVersionId);
    expect(updatedClone.content).toBe('clone-only');
    expect(sourceAfterWrite.content).toBe('shared');
    expect(cloneAfterWrite?.isContentOwner).toBe(true);
    expect(sourceBeforeWrite?.contentOid).not.toBe(cloneAfterWrite?.contentOid);
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
});
