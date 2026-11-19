import { describe, expect, it } from 'bun:test';
import { ServiceError } from '@lowerdeck/error';
import JSZip from 'jszip';
import {
  isKnownToolingKind,
  parseSlateToolingArchive,
  parseSlateToolingManifest,
  selectToolingVersion,
  SLATES_RUNTIME_KIND
} from './index';

let runtimeManifest = {
  kind: SLATES_RUNTIME_KIND,
  version: '1.2.0',
  protocol: 'slates@2026-01-01',
  exports: ['createProviderHandler', 'SlatesProviderProtoHandlerManager', 'serialize']
};

let createArchive = async (files: Record<string, string>) => {
  let zip = new JSZip();
  for (let [path, content] of Object.entries(files)) zip.file(path, content);

  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
};

let parseError = async (promise: Promise<unknown>) => {
  let error = await promise.catch(error => error);
  expect(error).toBeInstanceOf(ServiceError);

  return (error as ServiceError<any>).data.message as string;
};

describe('slate tooling manifests', () => {
  it('defaults main to index.js', () => {
    expect(parseSlateToolingManifest(JSON.stringify(runtimeManifest)).main).toBe('index.js');
  });

  it('rejects invalid versions, kinds and main modules', () => {
    for (let changed of [
      { version: '1.2' },
      { version: 'v1.2.0' },
      { kind: 'Slates Runtime' },
      { protocol: 'slates' },
      { main: '../index.js' },
      { main: 'index.ts' },
      { exports: ['not-an-identifier'] }
    ]) {
      expect(() =>
        parseSlateToolingManifest(JSON.stringify({ ...runtimeManifest, ...changed }))
      ).toThrow(ServiceError);
    }
  });

  it('only knows the slates runtime kind', () => {
    expect(isKnownToolingKind(SLATES_RUNTIME_KIND)).toBe(true);
    expect(isKnownToolingKind('future-kind')).toBe(false);
    expect(isKnownToolingKind('constructor')).toBe(false);
  });
});

describe('slate tooling archives', () => {
  it('parses a valid runtime archive and checksums its contents', async () => {
    let buffer = await createArchive({
      'runtime.json': JSON.stringify(runtimeManifest),
      'index.js': 'module.exports = {};'
    });

    let parsed = await parseSlateToolingArchive({
      buffer,
      kind: SLATES_RUNTIME_KIND,
      version: '1.2.0'
    });

    expect(parsed.manifest.main).toBe('index.js');
    expect(parsed.contentChecksum).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('rejects archives that do not match the upload', async () => {
    let buffer = await createArchive({
      'runtime.json': JSON.stringify(runtimeManifest),
      'index.js': 'module.exports = {};'
    });

    expect(
      await parseError(
        parseSlateToolingArchive({ buffer, kind: SLATES_RUNTIME_KIND, version: '1.3.0' })
      )
    ).toContain('expected 1.3.0');
    expect(
      await parseError(parseSlateToolingArchive({ buffer, kind: 'other', version: '1.2.0' }))
    ).toContain('expected other');
  });

  it('rejects archives without a manifest, main module or required exports', async () => {
    let missingManifest = await createArchive({ 'index.js': 'module.exports = {};' });
    let missingMain = await createArchive({ 'runtime.json': JSON.stringify(runtimeManifest) });
    let missingExport = await createArchive({
      'runtime.json': JSON.stringify({ ...runtimeManifest, exports: ['serialize'] }),
      'index.js': 'module.exports = {};'
    });

    let parse = (buffer: Buffer) =>
      parseSlateToolingArchive({ buffer, kind: SLATES_RUNTIME_KIND, version: '1.2.0' });

    expect(await parseError(parse(missingManifest))).toContain('runtime.json');
    expect(await parseError(parse(missingMain))).toContain('main module');
    expect(await parseError(parse(missingExport))).toContain('createProviderHandler');
  });
});

describe('selectToolingVersion', () => {
  let artifacts = [
    { version: '1.2.0', protocol: 'slates@2026-01-01' },
    { version: '1.10.0', protocol: 'slates@2026-01-01' },
    { version: '2.0.0', protocol: 'slates@2027-01-01' },
    { version: '1.11.0-rc.1', protocol: 'slates@2026-01-01' }
  ];

  it('picks the highest semver among supported protocols', () => {
    expect(
      selectToolingVersion({ artifacts, protocols: ['slates@2026-01-01'] })?.version
    ).toBe('1.11.0-rc.1');
    expect(
      selectToolingVersion({
        artifacts: artifacts.slice(0, 3),
        protocols: ['slates@2026-01-01']
      })?.version
    ).toBe('1.10.0');
  });

  it('returns a pinned version only if its protocol is supported', () => {
    expect(
      selectToolingVersion({ artifacts, protocols: ['slates@2026-01-01'], version: '1.2.0' })
        ?.version
    ).toBe('1.2.0');
    expect(
      selectToolingVersion({ artifacts, protocols: ['slates@2026-01-01'], version: '2.0.0' })
    ).toBeNull();
  });

  it('returns null when nothing supports the protocol', () => {
    expect(selectToolingVersion({ artifacts, protocols: ['slates@2030-01-01'] })).toBeNull();
  });
});
