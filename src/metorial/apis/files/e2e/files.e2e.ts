import {
  authHeaders,
  expectOk,
  metorialEndpoints,
  rest,
  uniqueId,
  useOrganization,
  type RestAuth
} from '@metorial/e2e';
import { describe, expect, it } from 'vitest';

let uploadFile = async (
  auth: RestAuth,
  input: { content: string; fileName: string; purpose: string; title?: string }
) => {
  let form = new FormData();
  form.set('file', new File([input.content], input.fileName, { type: 'text/plain' }));
  form.set('purpose', input.purpose);
  if (input.title) form.set('title', input.title);

  let response = await fetch(new URL('/files', metorialEndpoints().api), {
    method: 'POST',
    headers: { accept: 'application/json', ...authHeaders(auth) },
    body: form
  });

  return { status: response.status, body: await response.json() };
};

describe('api-files', () => {
  let org = useOrganization();

  it('serves /ping on the file content API', async () => {
    let response = await rest(metorialEndpoints().files).get('/ping');
    expect(response.status).toBe(200);
    expect(response.text).toBe('OK');
  });

  it('rejects unauthenticated uploads', async () => {
    let multipart = await uploadFile(
      {},
      { content: 'nope', fileName: 'nope.txt', purpose: 'generic' }
    );
    expect(multipart.status).toBe(401);

    let json = await rest(metorialEndpoints().api).post('/files', {
      mode: 'get_upload_url',
      purpose: 'generic',
      file_name: 'nope.txt',
      file_size: 4
    });
    expect(json.status).toBe(401);
  });

  it('rejects malformed uploads from an authenticated instance key', async () => {
    let auth = { apiKey: org.keys.instanceSecret };

    let invalidPurpose = await uploadFile(auth, {
      content: 'hello',
      fileName: 'hello.txt',
      purpose: 'not_a_purpose'
    });
    expect(invalidPurpose.status).toBe(400);
    expect(invalidPurpose.body.message).toMatch(/Invalid purpose/);

    let directAsJson = await rest(metorialEndpoints().api, auth).post('/files', {
      mode: 'direct',
      purpose: 'generic'
    });
    expect(directAsJson.status).toBe(400);
    expect(directAsJson.body.message).toMatch(/multipart\/form-data/);
  });

  it('uploads a file with an instance key and serves it through a file link', async () => {
    let content = `hello from ${uniqueId('api-files')}`;
    let fileName = `${uniqueId('e2e-file')}.txt`;

    let upload = await uploadFile(
      { apiKey: org.keys.instanceSecret },
      { content, fileName, purpose: 'generic', title: 'E2E file' }
    );
    expect(upload.status).toBe(200);
    expect(upload.body).toMatchObject({
      object: 'file',
      file_name: fileName,
      file_size: content.length,
      title: 'E2E file',
      purpose: { identifier: 'generic' }
    });

    let file = expectOk(await org.clients.instance.get(`/files/${upload.body.id}`));
    expect(file.id).toBe(upload.body.id);

    let link = expectOk(await org.clients.instance.post('/file-links', { file_id: file.id }));
    expect(link.file_id).toBe(file.id);

    let [linkFileId, linkKey] = new URL(link.url).pathname.split('/').slice(-2);
    expect(linkFileId).toBe(file.id);

    let downloaded = await fetch(
      new URL(`/files/${linkFileId}/${linkKey}`, metorialEndpoints().files)
    );
    expect(downloaded.status).toBe(200);
    expect(await downloaded.text()).toBe(content);

    let unknownKey = await rest(metorialEndpoints().files).get(
      `/files/${file.id}/${uniqueId('missing-key')}`
    );
    expect(unknownKey.status).toBe(404);
  });
});
