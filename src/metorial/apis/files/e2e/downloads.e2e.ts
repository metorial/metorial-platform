import { expectOk, metorialEndpoints, uniqueId, useOrganization } from '@metorial/e2e';
import { db } from '@metorial/e2e/db';
import { createSignedFileDownloadKey, fileRouterSecretHeader } from '@metorial/module-file';
import { describe, expect, it } from 'vitest';
import { allByteValues, fetchFileContent, linkPath, uploadDirect } from './_fixtures';

describe('api-files downloads', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let upload = async (input: Parameters<typeof uploadDirect>[1] = {}) => {
    let response = await uploadDirect({ apiKey: org.keys.instanceSecret }, input);
    if (response.status !== 200) {
      throw new Error(
        `Upload failed with ${response.status}: ${JSON.stringify(response.body)}`
      );
    }
    return response.body as { id: string; file_name: string };
  };

  let createLink = async (fileId: string, expiresAt?: Date) =>
    expectOk(
      await org.clients.instance.post('/file-links', {
        file_id: fileId,
        ...(expiresAt ? { expires_at: expiresAt.toISOString() } : {})
      })
    ) as { id: string; url: string; expires_at: string | null };

  let download = async (url: string, query = '') => {
    let { fileId, key } = linkPath(url);
    return await fetchFileContent(fileId, key, query);
  };

  it('serves binary and empty files byte for byte through a link', async () => {
    let content = allByteValues();
    let binary = await upload({ content, fileName: 'bytes.bin' });
    let response = await download((await createLink(binary.id)).url);

    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(content);

    let empty = await upload({ content: new Uint8Array(), fileName: 'empty.bin' });
    let emptyResponse = await download((await createLink(empty.id)).url);
    expect(emptyResponse.status).toBe(200);
    expect((await emptyResponse.arrayBuffer()).byteLength).toBe(0);

    let emptyText = await upload({ content: '', fileName: 'empty.txt', type: 'text/plain' });
    let emptyTextResponse = await download((await createLink(emptyText.id)).url);
    expect(emptyTextResponse.status).toBe(200);
    expect(await emptyTextResponse.text()).toBe('');
  });

  it('serves content with safe headers', async () => {
    let binary = await upload({ content: 'binary', fileName: 'data.bin' });
    let binaryLink = await createLink(binary.id);
    let binaryResponse = await download(binaryLink.url);
    expect({
      type: binaryResponse.headers.get('content-type'),
      nosniff: binaryResponse.headers.get('x-content-type-options'),
      cache: binaryResponse.headers.get('cache-control'),
      disposition: binaryResponse.headers.get('content-disposition')
    }).toEqual({
      type: 'application/octet-stream',
      nosniff: 'nosniff',
      cache: 'public, max-age=31536000, immutable',
      disposition: `inline; filename="data.bin"; filename*=UTF-8''data.bin`
    });

    let attachment = await download(binaryLink.url, '?download');
    expect(attachment.headers.get('content-disposition')).toBe(
      `attachment; filename="data.bin"; filename*=UTF-8''data.bin`
    );

    let html = await upload({
      content: '<script>alert(1)</script>',
      fileName: 'page.html',
      type: 'text/html'
    });
    let htmlResponse = await download((await createLink(html.id)).url);
    expect(htmlResponse.headers.get('content-type')).toBe('application/octet-stream');
    expect(htmlResponse.headers.get('x-content-type-options')).toBe('nosniff');
    expect(htmlResponse.headers.get('cache-control')).toBe('private, no-store');
    expect(await htmlResponse.text()).toBe('<script>alert(1)</script>');

    let image = await upload({
      content: 'png bytes',
      fileName: 'logo.png',
      type: 'image/png'
    });
    let imageResponse = await download((await createLink(image.id)).url);
    expect(imageResponse.headers.get('content-type')).toBe('image/png');

    let unicode = await upload({ content: 'résumé', fileName: 'résumé v1.bin' });
    let unicodeResponse = await download((await createLink(unicode.id)).url);
    expect(unicodeResponse.headers.get('content-disposition')).toBe(
      `inline; filename="r_sum_ v1.bin"; filename*=UTF-8''${encodeURIComponent('résumé v1.bin')}`
    );
  });

  it('stops serving links once they expire or are revoked', async () => {
    let file = await upload({ content: 'expiring', fileName: 'expiring.bin' });

    let expiring = await createLink(file.id, new Date(Date.now() + 60 * 60_000));
    expect(expiring.expires_at).not.toBeNull();
    let fresh = await download(expiring.url);
    expect(fresh.status).toBe(200);
    expect(fresh.headers.get('cache-control')).toBe('private, no-store');

    await db.fileLink.update({
      where: { id: expiring.id },
      data: { expiresAt: new Date(Date.now() - 1000) }
    });
    let expired = await download(expiring.url);
    expect(expired.status).toBe(400);
    expect((await expired.json()).message).toBe('Link has expired');

    let revocable = await createLink(file.id);
    expect((await download(revocable.url)).status).toBe(200);
    expectOk(await org.clients.instance.delete(`/file-links/${revocable.id}`));
    expect((await download(revocable.url)).status).toBe(404);
  });

  it('only serves a link for its own file and only while the file exists', async () => {
    let first = await upload({ content: 'first', fileName: 'first.bin' });
    let second = await upload({ content: 'second', fileName: 'second.bin' });
    let { key } = linkPath((await createLink(first.id)).url);

    let crossed = await fetchFileContent(second.id, key);
    expect(crossed.status).toBe(404);

    let unknown = await fetchFileContent(first.id, uniqueId('missing-key'));
    expect(unknown.status).toBe(404);

    let doomed = await upload({ content: 'doomed', fileName: 'doomed.bin' });
    let doomedLink = await createLink(doomed.id);
    expect((await download(doomedLink.url)).status).toBe(200);

    expectOk(await org.clients.instance.delete(`/files/${doomed.id}`));
    expect((await download(doomedLink.url)).status).toBe(404);
  });

  it('serves signed download keys only for the file content they were issued for', async () => {
    let file = await upload({ content: 'signed content', fileName: 'signed.bin' });
    let other = await upload({ content: 'other content', fileName: 'other.bin' });
    let record = await db.file.findUniqueOrThrow({ where: { id: file.id } });

    let key = await createSignedFileDownloadKey(record);
    let signed = await fetchFileContent(file.id, key);
    expect(signed.status).toBe(200);
    expect(await signed.text()).toBe('signed content');

    expect((await fetchFileContent(other.id, key)).status).toBe(404);

    let middle = Math.floor(key.length / 2);
    let tampered = `${key.slice(0, middle)}${key[middle] === 'a' ? 'b' : 'a'}${key.slice(middle + 1)}`;
    expect((await fetchFileContent(file.id, tampered)).status).toBe(404);

    let expiredKey = await createSignedFileDownloadKey(record, { expiresInSeconds: -60 });
    expect((await fetchFileContent(file.id, expiredKey)).status).toBe(404);

    let routerProbe = await fetch(
      new URL(`/files/${file.id}/${key}`, metorialEndpoints().files),
      {
        headers: { [fileRouterSecretHeader]: uniqueId('not-the-secret') }
      }
    );
    expect(routerProbe.status).toBe(200);
    expect(await routerProbe.text()).toBe('signed content');

    expectOk(await org.clients.instance.delete(`/files/${file.id}`));
    expect((await fetchFileContent(file.id, key)).status).toBe(404);
  });

  it('does not let shared caches keep signed downloads past their expiry', async () => {
    let file = await upload({ content: 'short lived', fileName: 'short-lived.bin' });
    let record = await db.file.findUniqueOrThrow({ where: { id: file.id } });
    let key = await createSignedFileDownloadKey(record, { expiresInSeconds: 60 });

    let response = await fetchFileContent(file.id, key);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('keeps files and links invisible to other tenants', async () => {
    let file = await upload({ content: 'private', fileName: 'private.bin' });

    let foreignLink = await otherOrg.clients.instance.post('/file-links', {
      file_id: file.id
    });
    expect(foreignLink.status).toBe(404);

    let foreignRead = await otherOrg.clients.instance.get(`/files/${file.id}`);
    expect(foreignRead.status).toBe(404);

    let foreignDelete = await otherOrg.clients.instance.delete(`/files/${file.id}`);
    expect(foreignDelete.status).toBe(404);

    let link = await createLink(file.id);
    let foreignLinkRead = await otherOrg.clients.instance.get(`/file-links/${link.id}`);
    expect(foreignLinkRead.status).toBe(404);
    let foreignRevoke = await otherOrg.clients.instance.delete(`/file-links/${link.id}`);
    expect(foreignRevoke.status).toBe(404);

    expect((await download(link.url)).status).toBe(200);
  });
});
