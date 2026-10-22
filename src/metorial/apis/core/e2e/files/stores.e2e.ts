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
  createConsumerClient,
  createDocument,
  createPublishableClient,
  createStore,
  ownResourceStatuses,
  readStatuses,
  routeFor,
  tenantClients,
  uploadFile
} from './_shared';

describe('api-core stores', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);

  let publishable: RestClient;

  beforeAll(async () => {
    publishable = await createPublishableClient(org);
  });

  let clients = () =>
    tenantClients(org, otherOrg, { member: member.clients.rest, publishable });

  let addItems = async (client: RestClient, storeId: string, operations: object[]) =>
    expectOk(await client.patch(`/stores/${storeId}/items`, { operations }));

  it('applies the auth matrix to store reads and writes', async () => {
    let store = await createStore(org);

    await expectAuthMatrix(
      clients(),
      (client, name) => client.get(routeFor(org, name, '/stores')),
      readStatuses
    );
    await expectAuthMatrix(
      clients(),
      (client, name) => client.get(routeFor(org, name, `/stores/${store.id}`)),
      ownResourceStatuses
    );
    await expectAuthMatrix(
      clients(),
      (client, name) => client.get(routeFor(org, name, `/stores/${store.id}/permissions`)),
      ownResourceStatuses
    );

    let created = await expectAuthMatrix(
      clients(),
      (client, name) =>
        client.post(routeFor(org, name, '/stores'), { name: uniqueId(`store-by-${name}`) }),
      { ...readStatuses, publishable: 403 }
    );
    for (let name of ['session', 'member', 'management', 'instance'] as const) {
      expectPresented(created[name].body, 'store');
    }

    await expectAuthMatrix(
      clients(),
      (client, name) =>
        client.patch(routeFor(org, name, `/stores/${store.id}`), { name: `renamed-${name}` }),
      ownResourceStatuses
    );
    await expectAuthMatrix(
      clients(),
      (client, name) => client.delete(routeFor(org, name, `/stores/${store.id}`)),
      {
        none: 401,
        publishable: 403,
        otherSession: 404,
        otherManagement: 404,
        otherInstance: 404
      }
    );
  });

  it('rejects invalid store bodies and conflicting sources', async () => {
    let store = await createStore(org);

    expectError(await org.clients.instance.post('/stores', {}), 400, 'invalid_data');
    expectError(
      await org.clients.instance.post('/stores', { name: 'x', access: 'everyone' }),
      400,
      'invalid_data'
    );
    expectError(
      await org.clients.instance.patch(`/stores/${store.id}`, { access: 'nobody' }),
      400,
      'invalid_data'
    );
    expectError(
      await org.clients.instance.patch(`/stores/${store.id}/items`, { operations: 'add' }),
      400,
      'invalid_data'
    );

    expectError(
      await org.clients.instance.post('/stores', {
        name: uniqueId('both'),
        template_id: 'stt_missing',
        parent_id: store.id
      }),
      400,
      'bad_request'
    );
    expectError(
      await org.clients.instance.post('/stores', {
        name: uniqueId('orphan'),
        parent_id: 'sto_missing'
      }),
      404,
      'not_found'
    );
  });

  it('creates, reads, updates and hard-deletes a store', async () => {
    let name = uniqueId('lifecycle-store');
    let created = expectOk(await org.clients.instance.post('/stores', { name }));

    expectPresented(created, 'store');
    expect(created).toMatchObject({ name, item_count: 1 });

    let fetched = expectOk(
      await org.clients.management.get(routeFor(org, 'management', `/stores/${created.id}`))
    );
    expect(fetched).toMatchObject({ id: created.id, name, access: created.access });

    let updated = expectOk(
      await org.clients.instance.patch(`/stores/${created.id}`, {
        name: `${name}-renamed`,
        access: 'public_read'
      })
    );
    expect(updated).toMatchObject({
      id: created.id,
      name: `${name}-renamed`,
      access: 'public_read'
    });

    let permissions = expectOk(
      await org.clients.instance.get(`/stores/${created.id}/permissions`)
    );
    expectPresented(permissions, 'store.permissions');
    expect(permissions).toMatchObject({ store_id: created.id, has_full_access: true });

    let deleted = expectOk(await org.clients.instance.delete(`/stores/${created.id}`));
    expect(deleted.id).toBe(created.id);

    expectError(await org.clients.instance.get(`/stores/${created.id}`), 404, 'not_found');
    expectError(await org.clients.instance.delete(`/stores/${created.id}`), 404, 'not_found');

    let remaining = await listAll(org.clients.instance, '/stores', {
      query: { id: created.id }
    });
    expect(remaining).toEqual([]);
  });

  it('clones a parent store with its items', async () => {
    let parent = await createStore(org);
    let file = await uploadFile(org);
    await addItems(org.clients.instance, parent.id, [
      { type: 'add', path: '/docs/readme.txt', fileId: file.id }
    ]);

    let clone = expectOk(
      await org.clients.instance.post('/stores', {
        name: uniqueId('clone'),
        parent_id: parent.id
      })
    );
    expect(clone.id).not.toBe(parent.id);

    let items = await listAll(org.clients.instance, `/stores/${clone.id}/items`);
    expect(items.map(item => item.path)).toEqual(['/docs/readme.txt']);
    expect(items[0]).toMatchObject({ kind: 'file', store_id: clone.id });
  });

  it('pages through stores and filters them by id and creation time', async () => {
    let stores = [await createStore(org), await createStore(org), await createStore(org)];
    let idQuery = Object.fromEntries(stores.map((store, index) => [`id[${index}]`, store.id]));

    let paged = await listAll(org.clients.instance, '/stores', { query: idQuery, limit: 1 });
    expect(paged.map(store => store.id).sort()).toEqual(stores.map(store => store.id).sort());
    paged.forEach(store => expectPresented(store, 'store'));

    let single = await listAll(org.clients.instance, '/stores', {
      query: { id: stores[1]!.id }
    });
    expect(single.map(store => store.id)).toEqual([stores[1]!.id]);

    let future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(
      await listAll(org.clients.instance, '/stores', {
        query: { ...idQuery, 'created_at[gt]': future }
      })
    ).toEqual([]);
    expect(
      await listAll(org.clients.instance, '/stores', {
        query: { ...idQuery, 'created_at[lt]': future }
      })
    ).toHaveLength(3);

    expectError(
      await org.clients.instance.get('/stores', { query: { 'created_at[gt]': 'yesterday' } }),
      400,
      'invalid_data'
    );
  });

  it('keeps stores and their items invisible to other tenants', async () => {
    let store = await createStore(org);
    let file = await uploadFile(org);
    let [item] = (
      await addItems(org.clients.instance, store.id, [
        { type: 'add', path: '/private.txt', fileId: file.id }
      ])
    ).items;

    let foreign = otherOrg.clients.instance;
    expectError(await foreign.get(`/stores/${store.id}`), 404);
    expectError(await foreign.patch(`/stores/${store.id}`, { name: 'stolen' }), 404);
    expectError(await foreign.delete(`/stores/${store.id}`), 404);
    expectError(await foreign.get(`/stores/${store.id}/items`), 404);
    expectError(await foreign.get(`/stores/${store.id}/items/${item.id}`), 404);
    expectError(await foreign.get(`/stores/${store.id}/participants`), 404);
    expectError(
      await foreign.patch(`/stores/${store.id}/items`, {
        operations: [{ type: 'remove', itemId: item.id }]
      }),
      404
    );
    expectError(
      await foreign.post('/stores', { name: uniqueId('foreign-clone'), parent_id: store.id }),
      404
    );

    let foreignStore = expectOk(await foreign.post('/stores', { name: uniqueId('foreign') }));
    expectError(
      await foreign.patch(`/stores/${foreignStore.id}/items`, {
        operations: [{ type: 'add', path: '/borrowed.txt', fileId: file.id }]
      }),
      404
    );

    let foreignStores = await listAll(foreign, '/stores');
    expect(foreignStores.map(entry => entry.id)).not.toContain(store.id);

    let stillThere = expectOk(
      await org.clients.instance.get(`/stores/${store.id}/items/${item.id}`)
    );
    expect(stillThere.path).toBe('/private.txt');
  });

  it('adds, moves, lists and removes files, documents and directories', async () => {
    let store = await createStore(org);
    let file = await uploadFile(org, { fileName: 'data.txt' });
    let document = await createDocument(org, { content: '# Stored' });

    let added = await addItems(org.clients.instance, store.id, [
      { type: 'add', path: 'data/data.txt', fileId: file.id },
      { type: 'add', path: '/notes/readme.md', documentId: document.id },
      { type: 'add', path: '/archive' }
    ]);
    expectPresented(added, 'list(store.item)');

    let [fileItem, documentItem, directory] = added.items;
    expect(fileItem).toMatchObject({
      kind: 'file',
      path: '/data/data.txt',
      store_id: store.id
    });
    expect(fileItem.file).toMatchObject({ id: file.id });
    expect(documentItem).toMatchObject({ kind: 'document', path: '/notes/readme.md' });
    expect(documentItem.document).toMatchObject({ id: document.id });
    expect(directory).toMatchObject({ kind: 'directory', path: '/archive/' });

    let defaults = await listAll(org.clients.instance, `/stores/${store.id}/items`, {
      limit: 1
    });
    expect(defaults.map(item => item.id).sort()).toEqual(
      [fileItem.id, documentItem.id].sort()
    );

    let directories = await listAll(org.clients.instance, `/stores/${store.id}/items`, {
      query: { type: 'directory' }
    });
    expect(directories.map(item => item.path)).toEqual(
      expect.arrayContaining(['/archive/', '/data/', '/notes/'])
    );

    let byFile = await listAll(org.clients.instance, `/stores/${store.id}/items`, {
      query: { file_id: file.id }
    });
    expect(byFile.map(item => item.id)).toEqual([fileItem.id]);

    let byDocument = await listAll(org.clients.instance, `/stores/${store.id}/items`, {
      query: { document_id: document.id }
    });
    expect(byDocument.map(item => item.id)).toEqual([documentItem.id]);

    let moved = await addItems(org.clients.instance, store.id, [
      { type: 'modify', itemId: fileItem.id, path: '/archive/data.txt' }
    ]);
    expect(moved.items[0]).toMatchObject({ id: fileItem.id, path: '/archive/data.txt' });

    let fetched = expectOk(
      await org.clients.rest.get(
        routeFor(org, 'session', `/stores/${store.id}/items/${fileItem.id}`)
      )
    );
    expectPresented(fetched, 'store.item');
    expect(fetched).toMatchObject({ id: fileItem.id, path: '/archive/data.txt' });

    let storeFiles = await listAll(org.clients.instance, '/files', {
      query: { store_id: store.id }
    });
    expect(storeFiles.map(entry => entry.id)).toContain(file.id);

    await addItems(org.clients.instance, store.id, [
      { type: 'remove', itemId: documentItem.id }
    ]);
    let afterRemove = await listAll(org.clients.instance, `/stores/${store.id}/items`);
    expect(afterRemove.map(item => item.id)).toEqual([fileItem.id]);
    expectError(
      await org.clients.instance.get(`/stores/${store.id}/items/${documentItem.id}`),
      404
    );
  });

  it('rejects item operations that point at missing or foreign items', async () => {
    let store = await createStore(org);
    let otherStore = await createStore(org);
    let file = await uploadFile(org);
    let [item] = (
      await addItems(org.clients.instance, otherStore.id, [
        { type: 'add', path: '/elsewhere.txt', fileId: file.id }
      ])
    ).items;

    expectError(await org.clients.instance.get(`/stores/${store.id}/items/${item.id}`), 404);
    expectError(await org.clients.instance.get(`/stores/${store.id}/items/sti_missing`), 404);
    expectError(
      await org.clients.instance.patch(`/stores/${store.id}/items`, {
        operations: [{ type: 'add', path: '/missing.txt', fileId: 'fil_missing' }]
      }),
      404
    );
    expectError(
      await org.clients.instance.get(`/stores/${store.id}/items`, {
        query: { type: 'folder' }
      }),
      400,
      'invalid_data'
    );
  });

  it('refuses to delete a file that a store still references', async () => {
    let store = await createStore(org);
    let file = await uploadFile(org);
    await addItems(org.clients.instance, store.id, [
      { type: 'add', path: '/pinned.txt', fileId: file.id }
    ]);

    expectError(await org.clients.instance.delete(`/files/${file.id}`), 400, 'bad_request');
    expect(expectOk(await org.clients.instance.get(`/files/${file.id}`)).status).toBe(
      'active'
    );
  });

  it('lists the creator as a participant with read and write permissions', async () => {
    let store = expectOk(
      await org.clients.rest.post(routeFor(org, 'session', '/stores'), {
        name: uniqueId('participants')
      })
    );

    let participants = await listAll(
      org.clients.rest,
      routeFor(org, 'session', `/stores/${store.id}/participants`),
      { limit: 1 }
    );
    expect(participants).toHaveLength(1);
    expectPresented(participants[0], 'store.participant');
    expect(participants[0]).toMatchObject({ store_id: store.id });
    expect(participants[0].permissions).toEqual(
      expect.arrayContaining(['content_read', 'content_write'])
    );

    let fetched = expectOk(
      await org.clients.instance.get(`/stores/${store.id}/participants/${participants[0].id}`)
    );
    expect(fetched.id).toBe(participants[0].id);

    let otherStore = await createStore(org);
    expectError(
      await org.clients.instance.get(
        `/stores/${otherStore.id}/participants/${participants[0].id}`
      ),
      404
    );
    await expectAuthMatrix(
      clients(),
      (client, name) => client.get(routeFor(org, name, `/stores/${store.id}/participants`)),
      ownResourceStatuses
    );
  });

  it('lets portal consumers read stores but not create, update or delete them', async () => {
    let store = await createStore(org, { access: 'public_read' });
    let consumer = await createConsumerClient(org);
    let path = (suffix: string) => routeFor(org, 'consumer', suffix);

    expectOk(await consumer.get(path('/stores')));
    expectError(
      await consumer.post(path('/stores'), { name: uniqueId('consumer-store') }),
      403,
      'forbidden'
    );
    expectError(await consumer.patch(path(`/stores/${store.id}`), { name: 'consumer' }), 403);
    expectError(await consumer.delete(path(`/stores/${store.id}`)), 403);

    expect(expectOk(await org.clients.instance.get(`/stores/${store.id}`)).name).toBe(
      store.name
    );
  });
});
