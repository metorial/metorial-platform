import {
  authHeaders,
  expectOk,
  expectPresented,
  metorialEndpoints,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  allByteValues,
  postHeadersOnly,
  postUpload,
  postUploadJson,
  seedPendingUpload,
  uploadDirect,
  uploadForm
} from './_fixtures';

describe('api-files uploads', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let instanceAuth = () => ({ apiKey: org.keys.instanceSecret });

  it('uploads to an instance with every credential that can reach it', async () => {
    let instanceId = org.ids.instanceId;

    let accepted = [
      { name: 'instance key', status: (await uploadDirect(instanceAuth())).status },
      {
        name: 'instance key with its own instance_id',
        status: (await uploadDirect(instanceAuth(), { fields: { instance_id: instanceId } }))
          .status
      },
      {
        name: 'management key with instance_id',
        status: (
          await uploadDirect(
            { apiKey: org.keys.management },
            { fields: { instance_id: instanceId } }
          )
        ).status
      },
      {
        name: 'session with instance_id',
        status: (
          await uploadDirect({ session: org.session }, { fields: { instance_id: instanceId } })
        ).status
      }
    ];
    expect(accepted).toEqual(accepted.map(item => ({ ...item, status: 200 })));

    let upload = await uploadDirect(instanceAuth(), { fileName: 'owned.bin' });
    let visible = expectOk(await org.clients.instance.get(`/files/${upload.body.id}`));
    expect(visible.id).toBe(upload.body.id);

    let foreignRead = await otherOrg.clients.instance.get(`/files/${upload.body.id}`);
    expect(foreignRead.status).toBe(404);
  });

  it('rejects uploads from missing, invalid and foreign credentials', async () => {
    let instanceId = org.ids.instanceId;

    let unauthenticated = await uploadDirect({});
    expect(unauthenticated.status).toBe(401);

    let invalidKey = await uploadDirect({ apiKey: `metorial_sk_${uniqueId('invalid')}` });
    expect(invalidKey.status).toBe(401);

    let managementWithoutInstance = await uploadDirect({ apiKey: org.keys.management });
    expect(managementWithoutInstance.status).toBe(400);
    expect(managementWithoutInstance.body.message).toBe(
      'Missing instance_id for machine API key'
    );

    let foreign = [
      { name: 'foreign instance key', auth: { apiKey: otherOrg.keys.instanceSecret } },
      { name: 'foreign management key', auth: { apiKey: otherOrg.keys.management } },
      { name: 'foreign session', auth: { session: otherOrg.session } }
    ];
    let statuses = [];
    for (let item of foreign) {
      let response = await uploadDirect(item.auth, { fields: { instance_id: instanceId } });
      statuses.push({ name: item.name, status: response.status });
    }
    expect(statuses).toEqual(foreign.map(item => ({ name: item.name, status: 404 })));

    let foreignOrganization = await uploadDirect(
      { session: otherOrg.session },
      { purpose: 'organization_image', fields: { organization_id: org.ids.organizationId } }
    );
    expect(foreignOrganization.status).toBe(404);
  });

  it('uploads organization-owned images with a session', async () => {
    let upload = await uploadDirect(
      { session: org.session },
      {
        content: 'logo',
        fileName: 'logo.png',
        type: 'image/png',
        purpose: 'organization_image',
        fields: { organization_id: org.ids.organizationId }
      }
    );
    expect(upload.status).toBe(200);
    expect(upload.body).toMatchObject({
      object: 'file',
      file_name: 'logo.png',
      file_type: 'image/png',
      purpose: { identifier: 'organization_image' }
    });

    let stored = await db.file.findUniqueOrThrow({
      where: { id: upload.body.id },
      include: { organization: true }
    });
    expect(stored.organization?.id).toBe(org.ids.organizationId);
    expect(stored.instanceOid).toBeNull();

    let instanceRead = await org.clients.instance.get(`/files/${upload.body.id}`);
    expect(instanceRead.status).toBe(404);
  });

  it('uploads user-owned avatars with a session and no organization', async () => {
    let upload = await uploadDirect(
      { session: org.session },
      { content: 'avatar', fileName: 'avatar.png', type: 'image/png', purpose: 'user_image' }
    );
    expect(upload.status).toBe(200);

    let stored = await db.file.findUniqueOrThrow({ where: { id: upload.body.id } });
    expect(stored.userOid).not.toBeNull();
    expect(stored.organizationOid).toBeNull();
    expect(stored.instanceOid).toBeNull();
  });

  it('rejects malformed direct uploads with specific errors', async () => {
    let auth = instanceAuth();
    let cases: Array<{ form: FormData; message: string | RegExp }> = [
      { form: uploadForm({ purpose: 'generic' }), message: 'Missing file or purpose' },
      { form: uploadForm({ content: 'no purpose' }), message: 'Missing file or purpose' },
      {
        form: uploadForm({ content: 'doc', purpose: 'document' }),
        message: 'Invalid purpose'
      },
      {
        form: uploadForm({ content: 'x', purpose: 'generic', fields: { mode: 'bogus' } }),
        message: 'mode must be one of direct, get_upload_url, complete'
      },
      {
        form: uploadForm({ content: 'x', purpose: 'generic', fields: { store_id: 'sto_x' } }),
        message: 'store_id and path must be provided together'
      },
      {
        form: uploadForm({ content: 'x', purpose: 'generic', fields: { path: '/x.bin' } }),
        message: 'store_id and path must be provided together'
      },
      {
        form: uploadForm({
          content: 'x',
          purpose: 'generic',
          fields: { store_replace: 'yes' }
        }),
        message: 'store_replace must be true or false'
      },
      {
        form: uploadForm({
          content: 'x',
          purpose: 'generic',
          fields: { store_replace: 'true' }
        }),
        message: 'store_replace requires store_id and path'
      }
    ];

    let results = [];
    for (let item of cases) {
      let response = await postUpload(auth, item.form);
      results.push({ status: response.status, message: response.body?.message });
    }
    expect(results).toEqual(
      cases.map(item => ({
        status: 400,
        message:
          typeof item.message === 'string' ? item.message : expect.stringMatching(item.message)
      }))
    );

    let organizationStore = await uploadDirect(
      { session: org.session },
      {
        purpose: 'organization_image',
        fields: {
          organization_id: org.ids.organizationId,
          store_id: 'sto_anything',
          path: '/logo.png'
        }
      }
    );
    expect(organizationStore.status).toBe(400);
    expect(organizationStore.body.message).toBe(
      'Files can only be attached to stores when uploading to an instance'
    );

    let unknownStore = await uploadDirect(auth, {
      fields: { store_id: `sto_${uniqueId('missing')}`, path: '/x.bin' }
    });
    expect(unknownStore.status).toBe(404);
  });

  it('rejects oversized direct uploads from the declared Content-Length', async () => {
    let response = await postHeadersOnly(new URL('/files', metorialEndpoints().api), {
      ...authHeaders(instanceAuth()),
      accept: 'application/json',
      'content-type': 'multipart/form-data; boundary=e2e-boundary',
      'content-length': String(110 * 1024 * 1024)
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/at most 100 MB/);
    expect(response.body.hint).toMatch(/get_upload_url/);
  });

  it('stores direct uploads byte for byte and presents them', async () => {
    let fileName = `${uniqueId('binary')}.bin`;
    let upload = await uploadDirect(instanceAuth(), {
      content: allByteValues(),
      fileName,
      fields: { title: 'Binary upload' }
    });
    expect(upload.status).toBe(200);
    expectPresented(upload.body, 'file');
    expect(upload.body).toMatchObject({
      status: 'active',
      file_name: fileName,
      file_size: 256,
      file_type: 'application/octet-stream',
      title: 'Binary upload',
      purpose: { identifier: 'generic', name: 'Generic' }
    });

    let stored = await db.file.findUniqueOrThrow({ where: { id: upload.body.id } });
    expect(stored).toMatchObject({ fileSize: 256, isReadOnly: false, status: 'active' });

    let empty = await uploadDirect(instanceAuth(), {
      content: new Uint8Array(),
      fileName: 'empty.bin'
    });
    expect(empty.status).toBe(200);
    expect(empty.body.file_size).toBe(0);
  });

  it('validates JSON upload requests', async () => {
    let auth = instanceAuth();
    let valid = {
      mode: 'get_upload_url',
      purpose: 'generic',
      file_name: 'big.bin',
      file_size: 10
    };

    let invalidJson = await postUpload(auth, 'not json', 'application/json');
    expect(invalidJson.status).toBe(400);
    expect(invalidJson.body.message).toBe('Invalid JSON body');

    let notAnObject = await postUploadJson(auth, [valid]);
    expect(notAnObject.status).toBe(400);
    expect(notAnObject.body.message).toBe('Expected a JSON object body');

    let direct = await postUploadJson(auth, { ...valid, mode: 'direct' });
    expect(direct.status).toBe(400);
    expect(direct.body.message).toBe('Direct uploads must be sent as multipart/form-data');

    for (let body of [
      { ...valid, file_name: undefined },
      { ...valid, purpose: 'document' },
      { mode: 'complete' }
    ]) {
      let response = await postUploadJson(auth, body);
      expect({ status: response.status, code: response.body.code }).toEqual({
        status: 400,
        code: 'invalid_data'
      });
    }

    let messages = [];
    for (let body of [
      { ...valid, file_size: -1 },
      { ...valid, file_size: '10' },
      { ...valid, file_size: 2 * 1024 * 1024 * 1024 + 1 },
      { ...valid, purpose: 'sandbox_image_build_context', file_size: 50 * 1024 * 1024 + 1 },
      { ...valid, store_id: 'sto_x' },
      { ...valid, store_replace: true }
    ]) {
      let response = await postUploadJson(auth, body);
      messages.push({ status: response.status, message: response.body.message });
    }
    expect(messages).toEqual([
      { status: 400, message: expect.stringMatching(/whole number of zero or more/) },
      { status: 400, message: expect.stringMatching(/whole number of zero or more/) },
      { status: 400, message: expect.stringMatching(/at most 2 GB/) },
      { status: 400, message: expect.stringMatching(/50 MB/) },
      { status: 400, message: 'store_id and path must be provided together' },
      { status: 400, message: 'store_replace requires store_id and path' }
    ]);

    let uploadsBefore = await db.fileUpload.count({
      where: { instance: { id: org.ids.instanceId } }
    });
    let created = await postUploadJson(auth, valid);
    expect(created.status).toBe(200);
    expect(created.body.object).toBe('file_upload');
    expect(created.body.upload.method).toBe('PUT');
    expect(() => new URL(created.body.upload.url)).not.toThrow();
    expect(
      await db.fileUpload.count({ where: { instance: { id: org.ids.instanceId } } })
    ).toBe(uploadsBefore + 1);
  });

  it('completes pending uploads over HTTP for the owning instance only', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let content = allByteValues();
    let upload = await seedPendingUpload(fixture, { size: content.length, content });

    let foreign = await postUploadJson(
      { apiKey: otherOrg.keys.instanceSecret },
      { mode: 'complete', file_upload_id: upload.id }
    );
    expect(foreign.status).toBe(404);

    let completed = await postUploadJson(instanceAuth(), {
      mode: 'complete',
      file_upload_id: upload.id
    });
    expect(completed.status).toBe(200);
    expectPresented(completed.body, 'file');
    expect(completed.body).toMatchObject({
      status: 'active',
      file_name: upload.fileName,
      file_size: 256,
      purpose: { identifier: 'generic' }
    });

    let again = await postUploadJson(
      { apiKey: org.keys.management },
      { mode: 'complete', file_upload_id: upload.id, instance_id: org.ids.instanceId }
    );
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(completed.body.id);

    let unknown = await postUploadJson(instanceAuth(), {
      mode: 'complete',
      file_upload_id: `fup_${uniqueId('missing')}`
    });
    expect(unknown.status).toBe(404);

    let mismatched = await seedPendingUpload(fixture, { size: 10, content: 'short' });
    let rejected = await postUploadJson(instanceAuth(), {
      mode: 'complete',
      file_upload_id: mismatched.id
    });
    expect(rejected.status).toBe(400);
    expect(rejected.body.message).toBe(
      'Uploaded content is 5 bytes but 10 bytes were declared'
    );
  });
});
