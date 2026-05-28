import { mkdir, mkdtemp, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildNodeProxyWrapperScript } from './deploy';

let tempDirs: string[] = [];

let createWrapperDir = async (files: Record<string, string>) => {
  let dir = await mkdtemp(join(tmpdir(), 'fbay-wrapper-test-'));
  tempDirs.push(dir);

  for (let [filename, content] of Object.entries(files)) {
    await writeFile(join(dir, filename), content, 'utf-8');
  }

  await writeFile(
    join(dir, 'metorial_deflector_wrapper.cjs'),
    buildNodeProxyWrapperScript('index.handler'),
    'utf-8'
  );

  return dir;
};

afterEach(async () => {
  tempDirs = [];
});

describe('node proxy wrapper handler loading', () => {
  it('loads a CommonJS index.js bundle via require', async () => {
    let dir = await createWrapperDir({
      'index.js': `
        exports.handler = async (event) => ({
          statusCode: 200,
          body: { result: event.payload.value }
        });
      `
    });

    let wrapperPath = join(dir, 'metorial_deflector_wrapper.cjs');
    delete require.cache[require.resolve(wrapperPath)];
    let wrapper = require(wrapperPath);

    let result = await wrapper.handler({ payload: { value: 'ok' } });
    expect(result).toEqual({
      statusCode: 200,
      body: { result: 'ok' }
    });
  });

  it('loads an ESM index.js bundle after require hits ERR_REQUIRE_ESM', async () => {
    let dir = await createWrapperDir({
      'package.json': JSON.stringify({ type: 'module' }),
      'index.js': `
        export let handler = async (event) => ({
          statusCode: 200,
          body: { result: event.payload.value }
        });
      `
    });

    let wrapperPath = join(dir, 'metorial_deflector_wrapper.cjs');
    delete require.cache[require.resolve(wrapperPath)];
    let wrapper = require(wrapperPath);

    let result = await wrapper.handler({ payload: { value: 'esm' } });
    expect(result).toEqual({
      statusCode: 200,
      body: { result: 'esm' }
    });
  });

  it('loads a default export handler from an ESM bundle', async () => {
    let dir = await createWrapperDir({
      'package.json': JSON.stringify({ type: 'module' }),
      'index.js': `
        export default async (event) => ({
          statusCode: 200,
          body: { result: event.payload.value }
        });
      `
    });

    let wrapperPath = join(dir, 'metorial_deflector_wrapper.cjs');
    delete require.cache[require.resolve(wrapperPath)];
    let wrapper = require(wrapperPath);

    let result = await wrapper.handler({ payload: { value: 'default' } });
    expect(result).toEqual({
      statusCode: 200,
      body: { result: 'default' }
    });
  });

  it('surfaces missing handler dependencies instead of index.mjs', async () => {
    let dir = await createWrapperDir({
      'package.json': JSON.stringify({ type: 'module' }),
      'index.js': `import './sourcemap-register.cjs';\nexport let handler = async () => ({});`
    });

    let wrapperPath = join(dir, 'metorial_deflector_wrapper.cjs');
    delete require.cache[require.resolve(wrapperPath)];
    let wrapper = require(wrapperPath);

    await expect(wrapper.handler({ payload: {} })).rejects.toThrow(/sourcemap-register\.cjs/);
  });

  it('reports missing handler modules with tried paths and available files', async () => {
    let dir = await mkdtemp(join(tmpdir(), 'fbay-wrapper-test-'));
    tempDirs.push(dir);
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, 'metorial_deflector_wrapper.cjs'),
      buildNodeProxyWrapperScript('index.handler'),
      'utf-8'
    );

    let wrapperPath = join(dir, 'metorial_deflector_wrapper.cjs');
    delete require.cache[require.resolve(wrapperPath)];
    let wrapper = require(wrapperPath);

    await expect(wrapper.handler({ payload: {} })).rejects.toThrow(
      /Original handler module not found.*tried=index, index\.js, index\.cjs, index\.mjs/
    );
  });
});
