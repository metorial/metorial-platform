import { connect } from 'node:net';
import { authHeaders, metorialEndpoints, uniqueId, type RestAuth } from '@metorial/e2e';
import { db, type OrganizationFixture } from '@metorial/e2e/db';
import { generatePlainId } from '@metorial/id';
import {
  filePurposeService,
  getCargoFilesBucketName,
  getStorage
} from '@metorial/module-file';

export let allByteValues = () => Uint8Array.from({ length: 256 }, (_, index) => index);

export let postUpload = async (
  auth: RestAuth,
  body: FormData | string,
  contentType?: string
) => {
  let response = await fetch(new URL('/files', metorialEndpoints().api), {
    method: 'POST',
    headers: {
      accept: 'application/json',
      ...(contentType ? { 'content-type': contentType } : {}),
      ...authHeaders(auth)
    },
    body
  });
  let text = await response.text();

  return { status: response.status, body: text ? JSON.parse(text) : null };
};

export let uploadForm = (input: {
  content?: Uint8Array | string;
  fileName?: string;
  type?: string;
  purpose?: string;
  fields?: Record<string, string>;
}) => {
  let form = new FormData();
  if (input.content !== undefined) {
    form.set(
      'file',
      new File([input.content as BlobPart], input.fileName ?? `${uniqueId('upload')}.bin`, {
        type: input.type ?? 'application/octet-stream'
      })
    );
  }
  if (input.purpose !== undefined) form.set('purpose', input.purpose);
  for (let [key, value] of Object.entries(input.fields ?? {})) form.set(key, value);

  return form;
};

export let uploadDirect = async (
  auth: RestAuth,
  input: Parameters<typeof uploadForm>[0] = {}
) =>
  await postUpload(
    auth,
    uploadForm({ content: uniqueId('content'), purpose: 'generic', ...input })
  );

export let postUploadJson = async (auth: RestAuth, body: unknown) =>
  await postUpload(auth, JSON.stringify(body), 'application/json');

export let fetchFileContent = async (fileId: string, key: string, query = '') =>
  await fetch(new URL(`/files/${fileId}/${key}${query}`, metorialEndpoints().files));

export let linkPath = (url: string) => {
  let [fileId, key] = new URL(url).pathname.split('/').slice(-2);
  return { fileId: fileId!, key: key! };
};

export let seedPendingUpload = async (
  fixture: OrganizationFixture,
  input: { size: number; content?: Uint8Array | string; name?: string }
) => {
  let purpose = await filePurposeService.ensureGenericFilePurpose();
  let storeId = generatePlainId(20);

  if (input.content !== undefined) {
    await getStorage().putObject(
      getCargoFilesBucketName(),
      storeId,
      Buffer.from(input.content),
      'application/octet-stream'
    );
  }

  return await db.fileUpload.create({
    data: {
      id: `fup_${generatePlainId(24)}`,
      instanceOid: fixture.instance.oid,
      purposeOid: purpose.oid,
      storeId,
      fileName: input.name ?? `${uniqueId('pending')}.bin`,
      fileSize: input.size,
      fileType: 'application/octet-stream',
      uploadUrlExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  });
};

/**
 * Sends only the request head, so a declared Content-Length can exceed what is actually sent and
 * the server's header-based size check is observable without streaming the body.
 */
export let postHeadersOnly = (url: URL, headers: Record<string, string>) =>
  new Promise<{ status: number; body: any }>((resolve, reject) => {
    let socket = connect(Number(url.port), url.hostname);
    let received = '';

    let parse = () => {
      let separator = received.indexOf('\r\n\r\n');
      if (separator === -1) return null;

      let head = received.slice(0, separator);
      let body = received.slice(separator + 4);
      let status = Number(head.split(' ')[1]);
      let length = head.match(/^content-length:\s*(\d+)/im);
      if (!length || Buffer.byteLength(body) < Number(length[1])) return null;

      return { status, body: body ? JSON.parse(body) : null };
    };

    socket.setTimeout(60_000, () => {
      socket.destroy();
      reject(new Error(`No response from ${url} within 60s: ${received}`));
    });
    socket.on('connect', () => {
      let lines = [
        `POST ${url.pathname} HTTP/1.1`,
        `Host: ${url.host}`,
        ...Object.entries(headers).map(([name, value]) => `${name}: ${value}`),
        '',
        ''
      ];
      socket.write(lines.join('\r\n'));
    });
    socket.on('data', chunk => {
      received += chunk.toString();
      let parsed = parse();
      if (!parsed) return;

      socket.destroy();
      resolve(parsed);
    });
    socket.on('error', reject);
    socket.on('end', () => reject(new Error(`Incomplete response from ${url}: ${received}`)));
  });
