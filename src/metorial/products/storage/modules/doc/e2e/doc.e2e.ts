import { firstPage, rejectionOf, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { createResourceAuthorization } from '@metorial/module-access';
import { storeService } from '@metorial/module-store';
import { describe, expect, it } from 'vitest';
import { documentService, documentVersionService } from '../src';

let authorization = createResourceAuthorization({ restricted: false });

let createDocument = async (
  fixture: OrganizationFixture,
  input: { title?: string; content?: string; store?: { id: string; path: string } } = {}
) =>
  await documentService.createDocument({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    input: {
      title: input.title ?? uniqueId('doc'),
      content: input.content ?? '# Hello\n\nCreated by the e2e suite',
      store: input.store,
      authorization
    }
  });

describe('module-documents', () => {
  let org = useOrganization();

  it('creates a document with an initial version and gets and lists it', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let title = uniqueId('doc');
    let content = `# ${title}\n\nfirst version`;

    let document = await createDocument(fixture, { title, content });
    expect(document.title).toBe(title);
    expect(document.content.content).toBe(content);
    expect(document.maxVersionNumber).toBe(1);
    expect(document.currentVersion?.content.content).toBe(content);
    expect(document.file.fileType).toBe('text/markdown');
    expect(document.file.status).toBe('active');

    let fetched = await documentService.getDocumentById({
      project: fixture.project,
      instance: fixture.instance,
      authorization,
      documentId: document.id
    });
    expect(fetched.id).toBe(document.id);

    let listed = await firstPage(
      await documentService.listDocuments({
        project: fixture.project,
        instance: fixture.instance,
        authorization,
        ids: [document.id]
      })
    );
    expect(listed.map(item => item.id)).toEqual([document.id]);

    let versions = await firstPage(
      await documentVersionService.listDocumentVersions({
        project: fixture.project,
        instance: fixture.instance,
        authorization,
        documentId: document.id
      })
    );
    expect(versions.map(version => version.id)).toEqual([document.currentVersion!.id]);

    let version = await documentVersionService.getDocumentVersionById({
      project: fixture.project,
      instance: fixture.instance,
      authorization,
      documentVersionId: document.currentVersion!.id
    });
    expect(version.document.id).toBe(document.id);
  });

  it('records edits as a draft on the resolved document', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let document = await createDocument(fixture);
    let resolved = await documentService.getDocumentById({
      project: fixture.project,
      instance: fixture.instance,
      authorization,
      documentId: document.id
    });

    let nextTitle = uniqueId('edited-doc');
    let nextContent = `# ${nextTitle}\n\nedited`;
    let updated = await documentService.updateDocument({
      project: fixture.project,
      instance: fixture.instance,
      document: resolved,
      input: { title: nextTitle, content: nextContent, authorization }
    });
    expect(updated.hasDraft).toBe(true);
    expect(updated.resolvedTitle).toBe(nextTitle);
    expect(updated.resolvedContent).toBe(nextContent);

    let refetched = await documentService.getDocumentById({
      project: fixture.project,
      instance: fixture.instance,
      authorization,
      documentId: document.id
    });
    expect(refetched.resolvedContent).toBe(nextContent);
  });

  it('attaches a document to a store and deletes it', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let store = await storeService.createStore({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: { name: uniqueId('doc-store') }
    });

    let document = await createDocument(fixture, {
      store: { id: store.id, path: '/notes/readme.md' }
    });

    let inStore = await firstPage(
      await documentService.listDocuments({
        project: fixture.project,
        instance: fixture.instance,
        authorization,
        storeIds: [store.id]
      })
    );
    expect(inStore.map(item => item.id)).toEqual([document.id]);

    let item = await db.storeItem.findFirstOrThrow({
      where: { store: { id: store.id }, documentOid: document.oid }
    });
    expect(item.path).toBe('/notes/readme.md');
    expect(item.kind).toBe('document');

    let resolved = await documentService.getDocumentById({
      project: fixture.project,
      instance: fixture.instance,
      authorization,
      documentId: document.id
    });

    let stillReferenced = await rejectionOf(
      documentService.deleteDocument({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        authorization,
        document: resolved
      })
    );
    expect(stillReferenced.message).toMatch(/active references/);

    await storeService.modifyStoreItems({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      authorization,
      store,
      operations: [{ type: 'remove', itemId: item.id }]
    });

    let deleted = await documentService.deleteDocument({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      authorization,
      document: resolved
    });
    expect(deleted.file.status).toBe('deleted');

    await expect(
      documentService.getDocumentById({
        project: fixture.project,
        instance: fixture.instance,
        authorization,
        documentId: document.id
      })
    ).rejects.toThrow();
  });
});
