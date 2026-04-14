import { describe, expect, it } from 'bun:test';
import JSZip from 'jszip';
import tar from 'tar-stream';
import { gzipSync } from 'zlib';
import { createZipBuffer, readTarballEntries, readZipEntries } from '../slatePackage/archive';
import { normalizeSlatePackage } from '../slatePackage/manifest';
import { getPreferredCurrentSlateVersion } from './current';
import { getSlateVersionPromotion } from './promotion';

let createZipArchive = async (files: Record<string, string>) => {
  let zip = new JSZip();

  for (let [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }

  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
};

let createTarballArchive = async (files: Record<string, string>) =>
  await new Promise<Buffer>((resolve, reject) => {
    let pack = tar.pack();
    let chunks: Buffer[] = [];

    pack.on('data', (chunk: Buffer | Uint8Array | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    pack.on('end', () => {
      resolve(gzipSync(Buffer.concat(chunks)));
    });
    pack.on('error', reject);

    for (let [path, content] of Object.entries(files)) {
      pack.entry({ name: path }, content);
    }

    pack.finalize();
  });

describe('registry slate version helpers', () => {
  it('reads the published version from package.json in zip uploads', async () => {
    let zipBuffer = await createZipArchive({
      'package.json': JSON.stringify({
        name: '@npm/weather-package',
        version: '1.2.3',
        description: 'Weather slate'
      }),
      'slate.json': JSON.stringify({
        name: '@demo/weather',
        categories: ['utilities'],
        skills: ['forecast'],
        logoUrl: 'https://example.com/logo.png'
      }),
      'docs/guide.md': '# Guide',
      'README.md': '# Readme'
    });

    let entries = await readZipEntries(zipBuffer);
    let slatePackage = normalizeSlatePackage({
      entries,
      identifier: {
        scopeIdentifier: 'demo',
        slateIdentifier: 'weather'
      }
    });

    expect(slatePackage.manifest).toEqual({
      name: '@demo/weather',
      version: '1.2.3',
      description: 'Weather slate',
      categories: ['utilities'],
      skills: ['forecast'],
      logoUrl: 'https://example.com/logo.png'
    });
    expect(slatePackage.npmPackageName).toBe('@npm/weather-package');
    expect(slatePackage.docsFiles.map(file => file.path).sort()).toEqual([
      'README.md',
      'docs/guide.md'
    ]);
  });

  it('normalizes npm tarballs and rebuilds them as zip bundles', async () => {
    let tarballBuffer = await createTarballArchive({
      'package/package.json': JSON.stringify({
        name: '@npm/weather-package',
        version: '2.0.0'
      }),
      'package/slate.json': JSON.stringify({
        name: '@demo/weather',
        categories: ['utilities']
      }),
      'package/docs/getting-started.md': '# Start',
      'package/README.md': '# Readme'
    });

    let tarEntries = await readTarballEntries(tarballBuffer);
    let slatePackage = normalizeSlatePackage({
      entries: tarEntries,
      identifier: {
        scopeIdentifier: 'demo',
        slateIdentifier: 'weather'
      }
    });
    let zipBuffer = await createZipBuffer(tarEntries);
    let zippedEntries = await readZipEntries(zipBuffer);

    expect(slatePackage.manifest.version).toBe('2.0.0');
    expect(slatePackage.manifest.name).toBe('@demo/weather');
    expect(slatePackage.npmPackageName).toBe('@npm/weather-package');
    expect(zippedEntries.map(entry => entry.path).sort()).toEqual([
      'README.md',
      'docs/getting-started.md',
      'package.json',
      'slate.json'
    ]);
  });

  it('lets local unbuilt versions advance only the unbuilt current pointer', () => {
    let promotion = getSlateVersionPromotion({
      backend: 'local_unbuilt',
      version: '2.5.0',
      unbuiltCurrentVersion: '2.0.0',
      builtOrUnbuiltCurrentVersion: '3.0.0'
    });

    expect(promotion).toEqual({
      shouldSetUnbuiltCurrentVersion: true,
      shouldSetBuiltOrUnbuiltCurrentVersion: false
    });
  });

  it('indexes older npm versions without making them current', () => {
    let promotion = getSlateVersionPromotion({
      backend: 'npm',
      version: '2.5.0',
      unbuiltCurrentVersion: '2.0.0',
      builtOrUnbuiltCurrentVersion: '3.0.0'
    });

    expect(promotion).toEqual({
      shouldSetUnbuiltCurrentVersion: false,
      shouldSetBuiltOrUnbuiltCurrentVersion: false
    });
  });

  it('prefers whichever current version is newer when built is supported', () => {
    let selected = getPreferredCurrentSlateVersion({
      supportsBuilt: true,
      unbuiltCurrentVersion: {
        id: 'unbuilt',
        version: '2.0.0',
        createdAt: new Date('2026-01-01')
      },
      builtOrUnbuiltCurrentVersion: {
        id: 'built',
        version: '3.0.0',
        createdAt: new Date('2026-01-02')
      }
    });

    expect(selected?.id).toBe('built');
  });
});
