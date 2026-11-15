import fsSync from 'fs';
import fs from 'fs/promises';
import JSZip from 'jszip';
import { createHash } from 'crypto';
import { tmpdir } from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  compileKnativeEntrypoint,
  prepareKnativeBundle,
  writeFunctionPackage
} from './knative';
import { readBuildLayer } from './layer';

let findNcc = () => {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    let candidate = path.join(dir, 'node_modules', '.bin', 'ncc');
    if (fsSync.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }

  throw new Error('ncc not found');
};

let knativeLayer = {
  provider: 'knative',
  identifier: 'function-bay::layer::knative::test',
  version: '2026-11-01',
  os: 'linux',
  osIdentifier: 'runtime-function-node24',
  arch: 'x86_64'
};

let workDir: string;

beforeEach(async () => {
  workDir = await fs.mkdtemp(path.join(tmpdir(), 'builder-node-knative-'));
});

afterEach(async () => {
  await fs.rm(workDir, { recursive: true, force: true });
});

describe('readBuildLayer', () => {
  it('accepts the knative layer', () => {
    expect(readBuildLayer(JSON.stringify(knativeLayer))).toEqual(knativeLayer);
  });

  it('rejects unknown providers', () => {
    expect(() =>
      readBuildLayer(JSON.stringify({ ...knativeLayer, provider: 'nope' }))
    ).toThrow('Invalid build layer');
  });
});

describe('knative bundling', () => {
  it('compiles the user entrypoint directly, without a launcher, with source maps', async () => {
    let projectDir = path.join(workDir, 'project');
    let outDir = path.join(workDir, 'out');
    await fs.mkdir(projectDir);
    await fs.writeFile(
      path.join(projectDir, 'index.ts'),
      `import { greet } from './greet';\nexport let handler = async (input: { name: string }) => greet(input.name);\n`
    );
    await fs.writeFile(
      path.join(projectDir, 'greet.ts'),
      `export let greet = (name: string) => ({ message: 'hello ' + name });\n`
    );

    await compileKnativeEntrypoint({
      entrypoint: 'index.ts',
      outDir,
      cwd: projectDir,
      ncc: findNcc()
    });
    let { handler } = await prepareKnativeBundle(outDir);

    let files = await fs.readdir(outDir);
    expect(files).toContain('index.js.map');
    expect(files).not.toContain('sourcemap-register.cjs');

    let output = handler.startsWith('index.handler')
      ? 'index.js'
      : handler.replace(/\.handler$/, '');
    let source = await fs.readFile(path.join(outDir, output), 'utf-8');
    expect(source).not.toContain('function_bay.launcher');
    expect(source).not.toContain('__functionBay');

    let mod = await import(pathToFileURL(path.join(outDir, output)).href);
    let exported = mod.handler ?? mod.default?.handler;
    expect(await exported({ name: 'knative' })).toEqual({ message: 'hello knative' });
  }, 60_000);

  it('strips leftover source map register imports and finds the output file', async () => {
    await fs.writeFile(path.join(workDir, 'sourcemap-register.cjs'), '');
    await fs.writeFile(
      path.join(workDir, 'index.mjs'),
      `import './sourcemap-register.cjs';\nexport let handler = () => 1;\n`
    );
    await fs.writeFile(path.join(workDir, 'package.json'), '{"type":"module"}');

    expect(await prepareKnativeBundle(workDir)).toEqual({ handler: 'index.mjs.handler' });
    expect(await fs.readFile(path.join(workDir, 'index.mjs'), 'utf-8')).toBe(
      'export let handler = () => 1;\n'
    );
    expect(fsSync.existsSync(path.join(workDir, 'sourcemap-register.cjs'))).toBe(false);
    expect(await fs.readFile(path.join(workDir, 'package.json'), 'utf-8')).toBe(
      '{"type":"module"}'
    );
  });

  it('writes the zip and a manifest with its hash', async () => {
    let bundleDir = path.join(workDir, 'bundle');
    await fs.mkdir(bundleDir);
    await fs.writeFile(path.join(bundleDir, 'index.js'), 'exports.handler = () => 1;');
    await fs.writeFile(path.join(bundleDir, 'index.js.map'), '{}');

    let outputPath = path.join(workDir, 'output.zip');
    let manifestPath = path.join(workDir, 'manifest.json');
    let runtime = {
      identifier: '@function-bay/nodejs',
      layer: knativeLayer as any,
      handler: 'index.handler',
      runtime: { identifier: 'nodejs' as const, version: '24.x' as const }
    };

    await writeFunctionPackage({ runtime, directory: bundleDir, outputPath, manifestPath });

    let zipBytes = await fs.readFile(outputPath);
    let zip = await JSZip.loadAsync(zipBytes);
    expect(Object.keys(zip.files).sort()).toEqual(['index.js', 'index.js.map']);

    let manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
    expect(manifest).toEqual({
      runtime,
      hash: createHash('sha256').update(zipBytes).digest('hex')
    });
  });
});
