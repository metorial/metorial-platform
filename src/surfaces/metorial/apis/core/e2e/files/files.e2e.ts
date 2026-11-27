import {
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  useMember,
  useOrganization,
  type RestClient
} from '@metorial/e2e';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createPublishableClient,
  ownResourceStatuses,
  readStatuses,
  routeFor,
  tenantClients,
  uploadFile
} from './_shared';

describe('api-core files and file links', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);

  let publishable: RestClient;

  beforeAll(async () => {
    publishable = await createPublishableClient(org);
  });

  let clients = () =>
    tenantClients(org, otherOrg, { member: member.clients.rest, publishable });

  let createLink = async (fileId: string, body: Record<string, unknown> = {}) =>
    expectOk(await org.clients.instance.post('/file-links', { file_id: fileId, ...body }));

  it('applies the auth matrix to file reads and deletes', async () => {
    let file = await uploadFile(org);

    await expectAuthMatrix(
      clients(),
      (client, name) => client.get(routeFor(org, name, '/files')),
      readStatuses
    );
    await expectAuthMatrix(
      clients(),
      (client, name) => client.get(routeFor(org, name, `/files/${file.id}`)),
      ownResourceStatuses
    );
    await expectAuthMatrix(
      clients(),
      (client, name) => client.delete(routeFor(org, name, `/files/${file.id}`)),
      {
        none: 401,
        publishable: 403,
        otherSession: 404,
        otherManagement: 404,
        otherInstance: 404
      }
    );

    expect(expectOk(await org.clients.instance.get(`/files/${file.id}`)).status).toBe(
      'active'
    );
  });

  it('presents a signed download url only on the dashboard version', async () => {
    let file = await uploadFile(org, { fileName: 'presented.txt' });

    let instanceView = expectOk(await org.clients.instance.get(`/files/${file.id}`));
    expectPresented(instanceView, 'file');
    expect(instanceView).toMatchObject({
      id: file.id,
      status: 'active',
      file_name: 'presented.txt',
      purpose: 'generic'
    });
    expect(instanceView).not.toHaveProperty('download_url');

    for (let name of ['session', 'management'] as const) {
      let view = expectOk(await clients()[name].get(routeFor(org, name, `/files/${file.id}`)));
      expectPresented(view, 'file');
      expect(view).toHaveProperty('download_url');
      expect(view.id).toBe(file.id);
    }
  });

  it('pages through files and filters them by id and purpose', async () => {
    let files = [await uploadFile(org), await uploadFile(org), await uploadFile(org)];
    let idQuery = Object.fromEntries(files.map((file, index) => [`id[${index}]`, file.id]));

    let paged = await listAll(org.clients.instance, '/files', { query: idQuery, limit: 1 });
    expect(paged.map(file => file.id).sort()).toEqual(files.map(file => file.id).sort());
    paged.forEach(file => expectPresented(file, 'file'));

    expect(
      await listAll(org.clients.instance, '/files', {
        query: { ...idQuery, purpose: 'generic' }
      })
    ).toHaveLength(3);
    expect(
      await listAll(org.clients.instance, '/files', {
        query: { ...idQuery, purpose: 'user_image' }
      })
    ).toEqual([]);

    expectError(
      await org.clients.instance.get('/files', { query: { purpose: 'everything' } }),
      400,
      'invalid_data'
    );

    let foreign = await listAll(otherOrg.clients.instance, '/files', { query: idQuery });
    expect(foreign).toEqual([]);
  });

  it('soft-deletes a file, hides it from lists and refuses a second delete', async () => {
    let file = await uploadFile(org);
    let link = await createLink(file.id);

    let deleted = expectOk(await org.clients.instance.delete(`/files/${file.id}`));
    expect(deleted).toMatchObject({ id: file.id, status: 'deleted' });

    expect(expectOk(await org.clients.instance.get(`/files/${file.id}`)).status).toBe(
      'deleted'
    );
    expect(await listAll(org.clients.instance, '/files', { query: { id: file.id } })).toEqual(
      []
    );
    expectError(await org.clients.instance.delete(`/files/${file.id}`), 403, 'forbidden');

    let links = await listAll(org.clients.instance, '/file-links', {
      query: { file_id: file.id }
    });
    expect(links.map(entry => entry.id)).not.toContain(link.id);
  });

  it('refuses to link a deleted file', async () => {
    let file = await uploadFile(org);
    expectOk(await org.clients.instance.delete(`/files/${file.id}`));

    expectError(
      await org.clients.instance.post('/file-links', { file_id: file.id }),
      400,
      'bad_request'
    );
  });

  it('creates, reads, lists and revokes a file link', async () => {
    let file = await uploadFile(org);
    let expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    let link = await createLink(file.id, { expires_at: expiresAt.toISOString() });
    expectPresented(link, 'file.file_link');
    expect(link.file_id).toBe(file.id);
    expect(new Date(link.expires_at).getTime()).toBe(expiresAt.getTime());
    expect(new URL(link.url).pathname).toMatch(new RegExp(`/files/${file.id}/[^/]+$`));

    let second = await createLink(file.id);
    expect(second.expires_at).toBeNull();
    expect(second.url).not.toBe(link.url);

    let fetched = expectOk(await org.clients.instance.get(`/file-links/${link.id}`));
    expect(fetched).toMatchObject({ id: link.id, file_id: file.id, url: link.url });

    let listed = await listAll(org.clients.instance, '/file-links', {
      query: { file_id: file.id },
      limit: 1
    });
    expect(listed.map(entry => entry.id).sort()).toEqual([link.id, second.id].sort());

    let byLink = await listAll(org.clients.instance, '/files', {
      query: { file_link_id: link.id }
    });
    expect(byLink.map(entry => entry.id)).toEqual([file.id]);

    let fileView = expectOk(await org.clients.instance.get(`/files/${file.id}`));
    expect(JSON.stringify(fileView)).not.toContain(
      new URL(link.url).pathname.split('/').at(-1)!
    );

    expectOk(await org.clients.instance.delete(`/file-links/${link.id}`));
    expectError(await org.clients.instance.get(`/file-links/${link.id}`), 404, 'not_found');
    expectError(await org.clients.instance.delete(`/file-links/${link.id}`), 404, 'not_found');

    let remaining = await listAll(org.clients.instance, '/file-links', {
      query: { file_id: file.id }
    });
    expect(remaining.map(entry => entry.id)).toEqual([second.id]);
  });

  it('validates file link bodies', async () => {
    let file = await uploadFile(org);

    expectError(await org.clients.instance.post('/file-links', {}), 400, 'invalid_data');
    expectError(
      await org.clients.instance.post('/file-links', { file_id: file.id, expires_at: 'soon' }),
      400,
      'invalid_data'
    );
    expectError(
      await org.clients.instance.post('/file-links', { file_id: 'fil_missing' }),
      404,
      'not_found'
    );
  });

  it('applies the auth matrix to file links and hides them from other tenants', async () => {
    let file = await uploadFile(org);
    let link = await createLink(file.id);
    let linkDenials = {
      none: 401,
      publishable: [403, 404],
      otherSession: 404,
      otherManagement: 404,
      otherInstance: 404
    };

    await expectAuthMatrix(
      clients(),
      (client, name) => client.get(routeFor(org, name, '/file-links')),
      readStatuses
    );
    await expectAuthMatrix(
      clients(),
      (client, name) => client.post(routeFor(org, name, '/file-links'), { file_id: file.id }),
      { ...readStatuses, otherInstance: 404 }
    );
    await expectAuthMatrix(
      clients(),
      (client, name) => client.get(routeFor(org, name, `/file-links/${link.id}`)),
      { ...linkDenials, instance: 200 }
    );
    await expectAuthMatrix(
      clients(),
      (client, name) => client.delete(routeFor(org, name, `/file-links/${link.id}`)),
      linkDenials
    );

    let foreignLinks = await listAll(otherOrg.clients.instance, '/file-links');
    expect(foreignLinks.map(entry => entry.id)).not.toContain(link.id);
    expect(expectOk(await org.clients.instance.get(`/file-links/${link.id}`)).id).toBe(
      link.id
    );
  });

  it.fails(
    'shows file links to every credential of the owning organization (bug: links are scoped to the resource actor that created them)',
    async () => {
      let file = await uploadFile(org);
      let link = await createLink(file.id);

      for (let name of ['session', 'management'] as const) {
        let client = clients()[name];
        expectOk(await client.get(routeFor(org, name, `/file-links/${link.id}`)));

        let listed = await listAll(client, routeFor(org, name, '/file-links'), {
          query: { file_id: file.id }
        });
        expect(listed.map(entry => entry.id)).toContain(link.id);
      }
    }
  );
});
