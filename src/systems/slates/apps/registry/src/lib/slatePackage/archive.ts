import JSZip from 'jszip';
import tar from 'tar-stream';
import unzipper from 'unzipper';
import { gunzipSync } from 'zlib';

export type SlatePackageEntry = {
  path: string;
  buffer: Buffer;
};

let normalizeEntryPath = (path: string) =>
  path
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/^package\//, '')
    .replace(/^\/+/, '');

export let readZipEntries = async (buffer: Buffer) => {
  let directory = await unzipper.Open.buffer(buffer);

  let entries: SlatePackageEntry[] = [];
  for (let entry of directory.files) {
    if (entry.type !== 'File') continue;

    let path = normalizeEntryPath(entry.path);
    if (!path) continue;

    entries.push({
      path,
      buffer: await entry.buffer()
    });
  }

  return entries;
};

export let readTarballEntries = async (buffer: Buffer) =>
  await new Promise<SlatePackageEntry[]>((resolve, reject) => {
    let extract = tar.extract();
    let files: SlatePackageEntry[] = [];

    extract.on('entry', (header: any, stream: any, next: () => void) => {
      if (header.type !== 'file') {
        stream.resume();
        stream.on('end', next);
        return;
      }

      let chunks: Buffer[] = [];

      stream.on('data', (chunk: Buffer | Uint8Array | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on('end', () => {
        let path = normalizeEntryPath(header.name);
        if (path) {
          files.push({
            path,
            buffer: Buffer.concat(chunks)
          });
        }

        next();
      });
      stream.on('error', reject);
    });

    extract.on('finish', () => resolve(files));
    extract.on('error', reject);

    try {
      extract.end(gunzipSync(buffer));
    } catch (error) {
      reject(error);
    }
  });

export let createZipBuffer = async (entries: SlatePackageEntry[]) => {
  let zip = new JSZip();

  for (let entry of [...entries].sort((a, b) => a.path.localeCompare(b.path))) {
    zip.file(entry.path, entry.buffer);
  }

  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
};
