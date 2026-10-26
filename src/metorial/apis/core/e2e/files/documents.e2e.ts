import {
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  uniqueId,
  useMember,
  useOrganization,
  type RestClient
} from '@metorial/e2e';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  commitDocumentVersion,
  createDocument,
  createPublishableClient,
  createStore,
  editDocument,
  ownResourceStatuses,
  readStatuses,
  routeFor,
  tenantClients
} from './_shared';

describe('api-core documents', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);

  let publishable: RestClient;

  beforeAll(async () => {
    publishable = await createPublishableClient(org);
  });

  let clients = () =>
    tenantClients(org, otherOrg, { member: member.clients.rest, publishable });

  it('applies the auth matrix to document routes', async () => {
    let document = await createDocument(org);
    let documentPath = (suffix = '') => `/documents/${document.id}${suffix}`;

    await expectAuthMatrix(
      clients(),
      (client, name) => client.get(routeFor(org, name, '/documents')),
      readStatuses
    );
    await expectAuthMatrix(
      clients(),
      (client, name) =>
        client.post(routeFor(org, name, '/documents'), {
          title: uniqueId(`by-${name}`),
          content: 'hello'
        }),
      readStatuses
    );

    for (let suffix of ['', '/permissions', '/versions', '/participants', '/edit-token']) {
      await expectAuthMatrix(
        clients(),
        (client, name) => client.get(routeFor(org, name, documentPath(suffix))),
        ownResourceStatuses
      );
    }

    await expectAuthMatrix(
      clients(),
      (client, name) =>
        client.patch(routeFor(org, name, documentPath()), { title: `renamed-${name}` }),
      ownResourceStatuses
    );
    await expectAuthMatrix(
      clients(),
      (client, name) => client.post(routeFor(org, name, documentPath('/clone')), {}),
      ownResourceStatuses
    );
    await expectAuthMatrix(
      clients(),
      (client, name) => client.delete(routeFor(org, name, documentPath())),
      {
        none: 401,
        publishable: 403,
        otherSession: 404,
        otherManagement: 404,
        otherInstance: 404
      }
    );
  });

  it('rejects invalid document bodies and filters', async () => {
    let document = await createDocument(org);

    expectError(await org.clients.instance.post('/documents', {}), 400, 'invalid_data');
    expectError(
      await org.clients.instance.post('/documents', { title: 'no content' }),
      400,
      'invalid_data'
    );
    expectError(
      await org.clients.instance.patch(`/documents/${document.id}`, { content: 5 }),
      400,
      'invalid_data'
    );
    expectError(
      await org.clients.instance.post(`/documents/${document.id}/clone`, { title: 3 }),
      400,
      'invalid_data'
    );
    expectError(
      await org.clients.instance.get(`/documents/${document.id}/versions`, {
        query: { 'created_at[gt]': 'yesterday' }
      }),
      400,
      'invalid_data'
    );
    expectError(await org.clients.instance.get('/documents/doc_missing'), 404, 'not_found');
  });

  it('creates, reads, updates and deletes a document', async () => {
    let title = uniqueId('lifecycle-document');
    let created = expectOk(
      await org.clients.rest.post(routeFor(org, 'session', '/documents'), {
        title,
        content: '# Hello'
      })
    );

    expectPresented(created, 'document');
    expect(created).toMatchObject({
      title,
      content: '# Hello',
      status: 'active',
      parent_document_id: null
    });
    expect(created.current_version_id).toEqual(expect.any(String));
    expect(created.file_id).toEqual(expect.any(String));

    let fetched = expectOk(await org.clients.instance.get(`/documents/${created.id}`));
    expect(fetched).toMatchObject({ id: created.id, title, content: '# Hello' });

    let updated = expectOk(
      await org.clients.instance.patch(`/documents/${created.id}`, {
        title: `${title}-renamed`,
        content: '# Hello again'
      })
    );
    expect(updated).toMatchObject({ title: `${title}-renamed`, content: '# Hello again' });

    let byFile = await listAll(org.clients.instance, '/documents', {
      query: { file_id: created.file_id }
    });
    expect(byFile.map(entry => entry.id)).toEqual([created.id]);

    let permissions = expectOk(
      await org.clients.instance.get(`/documents/${created.id}/permissions`)
    );
    expectPresented(permissions, 'document.permissions');
    expect(permissions).toMatchObject({ document_id: created.id, has_full_access: true });

    let deleted = expectOk(await org.clients.instance.delete(`/documents/${created.id}`));
    expect(deleted.id).toBe(created.id);

    expectError(await org.clients.instance.get(`/documents/${created.id}`), 404, 'not_found');
    expectError(
      await org.clients.instance.patch(`/documents/${created.id}`, { title: 'zombie' }),
      404
    );
    expectError(await org.clients.instance.get(`/documents/${created.id}/versions`), 404);
    expect(
      await listAll(org.clients.instance, '/documents', { query: { id: created.id } })
    ).toEqual([]);
  });

  it('pages through documents and filters them by id and store', async () => {
    let documents = [
      await createDocument(org),
      await createDocument(org),
      await createDocument(org)
    ];
    let idQuery = Object.fromEntries(
      documents.map((entry, index) => [`id[${index}]`, entry.id])
    );

    let paged = await listAll(org.clients.instance, '/documents', {
      query: idQuery,
      limit: 1
    });
    expect(paged.map(entry => entry.id).sort()).toEqual(
      documents.map(entry => entry.id).sort()
    );
    paged.forEach(entry => expectPresented(entry, 'document'));

    let store = await createStore(org);
    expectOk(
      await org.clients.instance.patch(`/stores/${store.id}/items`, {
        operations: [{ type: 'add', path: '/stored.md', documentId: documents[0]!.id }]
      })
    );
    let inStore = await listAll(org.clients.instance, '/documents', {
      query: { store_id: store.id }
    });
    expect(inStore.map(entry => entry.id)).toEqual([documents[0]!.id]);

    let foreign = await listAll(otherOrg.clients.instance, '/documents', { query: idQuery });
    expect(foreign).toEqual([]);
  });

  it('lists versions newest first and keeps earlier content readable', async () => {
    let document = await createDocument(org, { content: 'version one' });

    let draft = await editDocument(org.clients.instance, document.id, 'version one, revised');
    expect(draft.current_version_id).toBe(document.current_version_id);
    expect(
      await listAll(org.clients.instance, `/documents/${document.id}/versions`)
    ).toHaveLength(1);

    let current = await commitDocumentVersion(
      org.clients.instance,
      document.id,
      'version two'
    );
    expect(current.content).toBe('version two');

    let versions = await listAll(org.clients.instance, `/documents/${document.id}/versions`, {
      limit: 1
    });
    expect(versions.map(version => version.version_number)).toEqual([2, 1]);

    let [second, first] = versions;
    versions.forEach(version => expectPresented(version, 'document.version'));
    expect(first).toMatchObject({
      document_id: document.id,
      previous_version_id: null,
      content: 'version one, revised'
    });
    expect(second).toMatchObject({
      document_id: document.id,
      previous_version_id: first.id,
      content: 'version two'
    });

    let refreshed = expectOk(await org.clients.instance.get(`/documents/${document.id}`));
    expect(refreshed.current_version_id).toBe(second.id);

    let fetched = expectOk(
      await org.clients.instance.get(`/documents/${document.id}/versions/${first.id}`)
    );
    expect(fetched).toMatchObject({ id: first.id, version_number: 1 });

    let filtered = await listAll(org.clients.instance, `/documents/${document.id}/versions`, {
      query: { id: first.id }
    });
    expect(filtered.map(version => version.id)).toEqual([first.id]);

    let otherDocument = await createDocument(org);
    expectError(
      await org.clients.instance.get(`/documents/${otherDocument.id}/versions/${first.id}`),
      404,
      'not_found'
    );
    expectError(
      await otherOrg.clients.instance.get(`/documents/${document.id}/versions/${first.id}`),
      404
    );
  });

  it('records participants per document', async () => {
    let document = expectOk(
      await org.clients.rest.post(routeFor(org, 'session', '/documents'), {
        title: uniqueId('participants'),
        content: 'shared'
      })
    );

    let participants = await listAll(
      org.clients.rest,
      routeFor(org, 'session', `/documents/${document.id}/participants`),
      { limit: 1 }
    );
    expect(participants.length).toBeGreaterThan(0);
    participants.forEach(participant => expectPresented(participant, 'document.participant'));

    let creator = participants.find(participant => participant.role === 'editor');
    expect(creator).toBeDefined();
    expect(creator.actor.organization_actor).not.toBeNull();

    let fetched = expectOk(
      await org.clients.instance.get(`/documents/${document.id}/participants/${creator.id}`)
    );
    expect(fetched).toMatchObject({ id: creator.id, role: 'editor' });

    let otherDocument = await createDocument(org);
    expectError(
      await org.clients.instance.get(
        `/documents/${otherDocument.id}/participants/${creator.id}`
      ),
      404
    );
    expectError(
      await otherOrg.clients.instance.get(
        `/documents/${document.id}/participants/${creator.id}`
      ),
      404
    );
  });

  it('issues a fresh short-lived edit token per request without exposing it elsewhere', async () => {
    let document = await createDocument(org);

    let first = expectOk(
      await org.clients.instance.get(`/documents/${document.id}/edit-token`)
    );
    expectPresented(first, 'document.edit_token');
    expect(first).toMatchObject({ document_id: document.id, token: expect.any(String) });
    expect(new Date(first.expires_at).getTime()).toBeGreaterThan(Date.now());

    let second = expectOk(
      await org.clients.instance.get(`/documents/${document.id}/edit-token`)
    );
    expect(second.token).not.toBe(first.token);

    let views = [
      expectOk(await org.clients.instance.get(`/documents/${document.id}`)),
      await listAll(org.clients.instance, '/documents', { query: { id: document.id } }),
      await listAll(org.clients.instance, `/documents/${document.id}/participants`),
      await listAll(org.clients.instance, `/documents/${document.id}/versions`)
    ];
    for (let view of views) {
      expect(JSON.stringify(view)).not.toContain(first.token);
    }

    expectError(
      await otherOrg.clients.instance.get(`/documents/${document.id}/edit-token`),
      404
    );
  });

  it('clones a document as a child that the parent filter finds', async () => {
    let parent = await createDocument(org, { content: 'cloned body' });

    let clone = expectOk(
      await org.clients.instance.post(`/documents/${parent.id}/clone`, {
        title: 'Cloned copy'
      })
    );
    expectPresented(clone, 'document');
    expect(clone).toMatchObject({
      title: 'Cloned copy',
      content: 'cloned body',
      parent_document_id: parent.id
    });
    expect(clone.id).not.toBe(parent.id);

    let children = await listAll(org.clients.instance, '/documents', {
      query: { parent_document_id: parent.id }
    });
    expect(children.map(entry => entry.id)).toEqual([clone.id]);

    expectError(
      await otherOrg.clients.instance.post(`/documents/${parent.id}/clone`, {}),
      404
    );
  });

  it('keeps documents invisible to other tenants', async () => {
    let document = await createDocument(org);
    let foreign = otherOrg.clients.instance;

    expectError(await foreign.get(`/documents/${document.id}`), 404);
    expectError(await foreign.patch(`/documents/${document.id}`, { title: 'stolen' }), 404);
    expectError(await foreign.delete(`/documents/${document.id}`), 404);
    expectError(await foreign.get(`/documents/${document.id}/permissions`), 404);
    expectError(await foreign.get(`/documents/${document.id}/versions`), 404);
    expectError(await foreign.get(`/documents/${document.id}/participants`), 404);

    let foreignList = await listAll(foreign, '/documents');
    expect(foreignList.map(entry => entry.id)).not.toContain(document.id);
    expect(expectOk(await org.clients.instance.get(`/documents/${document.id}`)).title).toBe(
      document.title
    );
  });
});
