import { v } from '@lowerdeck/validation';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let fingerprintTimeoutMs = 10_000;
let archiveTimeoutMs = 60_000;
let maxArchiveBytes = 64 * 1024 * 1024;

let fingerprintFile = 'fingerprint.json';
let archiveFile = 'catalog.json.gz';

let fingerprintSchema = v.object({
  fingerprint: v.string(),
  generatedAt: v.optional(v.string())
});

export type FingerprintResult =
  { status: 'unchanged' } | { status: 'changed'; fingerprint: string; etag: string | null };

let isFileUrl = (baseUrl: string) => baseUrl.startsWith('file://');

let fileIn = (baseUrl: string, file: string) => path.join(fileURLToPath(baseUrl), file);

let urlFor = (baseUrl: string, file: string) => `${baseUrl.replace(/\/+$/, '')}/${file}`;

let parseFingerprint = (text: string) => {
  let validated = fingerprintSchema.validate(JSON.parse(text));
  if (!validated.success)
    throw new Error('The model catalog fingerprint has an unexpected shape.');

  return validated.value.fingerprint;
};

export let fetchFingerprint = async (d: {
  baseUrl: string;
  etag?: string | null;
}): Promise<FingerprintResult> => {
  if (isFileUrl(d.baseUrl)) {
    let fingerprint = parseFingerprint(
      await readFile(fileIn(d.baseUrl, fingerprintFile), 'utf8')
    );
    return { status: 'changed', fingerprint, etag: null };
  }

  let response = await fetch(urlFor(d.baseUrl, fingerprintFile), {
    headers: d.etag ? { 'If-None-Match': d.etag } : {},
    signal: AbortSignal.timeout(fingerprintTimeoutMs)
  });

  if (response.status == 304) return { status: 'unchanged' };
  if (!response.ok) {
    throw new Error(`Model catalog fingerprint request failed with ${response.status}.`);
  }

  return {
    status: 'changed',
    fingerprint: parseFingerprint(await response.text()),
    etag: response.headers.get('etag')
  };
};

let readLimited = async (response: Response) => {
  let declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > maxArchiveBytes) throw new Error('The model catalog archive is too large.');

  let chunks: Uint8Array[] = [];
  let size = 0;

  for await (let chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    size += chunk.byteLength;
    if (size > maxArchiveBytes) throw new Error('The model catalog archive is too large.');

    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
};

export let fetchArchive = async (baseUrl: string): Promise<Buffer> => {
  if (isFileUrl(baseUrl)) return await readFile(fileIn(baseUrl, archiveFile));

  let response = await fetch(urlFor(baseUrl, archiveFile), {
    signal: AbortSignal.timeout(archiveTimeoutMs)
  });
  if (!response.ok || !response.body) {
    throw new Error(`Model catalog archive request failed with ${response.status}.`);
  }

  return await readLimited(response);
};
