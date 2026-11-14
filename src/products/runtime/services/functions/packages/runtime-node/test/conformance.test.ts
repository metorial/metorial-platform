import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getMetorialLauncher } from '../../builder-node/src/launcher';
import { createInvoker, loadModule, runtimeError, serializeResult } from '../src/entrypoint';

let lambdaLayer = {
  provider: 'aws.lambda',
  identifier: 'nodejs',
  version: '24.x',
  os: 'linux',
  osIdentifier: 'amazonlinux2023',
  arch: 'arm64'
} as const;

let fixtures: Record<string, string> = {
  'default-export.mjs': `export default async data => ({ echo: data });`,
  'named-handler.mjs': `export let handler = async data => ({ named: data });`,
  'default-and-handler.mjs': `export default async () => 'default'; export let handler = async () => 'handler';`,
  'sync-handler.mjs': `export let handler = data => [data, typeof data];`,
  'cjs-function.cjs': `module.exports = async data => ({ cjs: data });`,
  'cjs-object.cjs': `module.exports = { handler: async data => ({ object: data }) };`,
  'function-bay-error.mjs': `
    class FunctionBayError extends Error {
      __function_bay_error = true;
      toResponse() { return { code: 'fixture.denied', message: 'Not allowed', data: { field: 'x' } }; }
    }
    export default async () => { throw new FunctionBayError('denied'); };`,
  'plain-error.mjs': `
    export default async () => {
      let err = new TypeError('broken');
      err.stack = 'TypeError: broken\\n    at fixture (plain-error.mjs:3:17)';
      throw err;
    };`,
  'thrown-string.mjs': `export default async () => { throw 'just a string'; };`,
  'thrown-object.mjs': `export default async () => { throw { detail: 1 }; };`,
  'thrown-null.mjs': `export default async () => { throw null; };`,
  'no-handler.mjs': `export let other = 1;`,
  'returns-undefined.mjs': `export default async () => {};`,
  'returns-falsy.mjs': `export default async () => 0;`
};

let payloads: [string, unknown][] = [
  ['object', { a: 1, text: 'grüße 👋', nested: { list: [1, 'two', null] } }],
  ['array', [1, 2, 3]],
  ['json string', JSON.stringify({ fromString: true })],
  ['invalid json string', '{not json'],
  ['plain string', 'hello'],
  ['number', 42],
  ['null', null],
  ['zero', 0],
  ['false', false],
  ['empty string', '']
];

let dir: string;

let jsonRoundTrip = (value: unknown) => JSON.parse(serializeResult(value));

let runLauncher = async (fixture: string, payload: unknown) => {
  let launcher = await getMetorialLauncher({ bundledEntrypoint: fixture, layer: lambdaLayer });
  let file = path.join(dir, `launcher-${fixture}.mjs`);
  await fs.writeFile(file, launcher.files[0]!.content);
  let mod = await import(pathToFileURL(file).href);
  try {
    return jsonRoundTrip(await mod.handler({ payload }));
  } catch (err) {
    return { rejected: runtimeError(err) };
  }
};

let runBootstrap = async (fixture: string, payload: unknown) => {
  let mod = await loadModule(path.join(dir, fixture));
  let invoke = createInvoker(mod, { path: fixture, export: 'handler', kind: 'module' });
  return jsonRoundTrip(await invoke(JSON.stringify(payload)));
};

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'runtime-node-conformance-'));
  for (let [name, content] of Object.entries(fixtures)) {
    await fs.writeFile(path.join(dir, name), content);
  }
});

afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('entrypoint conformance with the Lambda launcher', () => {
  let errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  for (let fixture of Object.keys(fixtures)) {
    for (let [label, payload] of payloads) {
      it(`${fixture} with ${label} payload`, async () => {
        errorSpy.mockClear();
        let expected = await runLauncher(fixture, payload);
        let launcherLogged = errorSpy.mock.calls.length;

        errorSpy.mockClear();
        let actual = await runBootstrap(fixture, payload);

        if (expected?.rejected) {
          expect(actual.errorType).toBe(expected.rejected.errorType);
          expect(actual.errorMessage).toBe(expected.rejected.errorMessage);
        } else {
          expect(actual).toEqual(expected);
        }
        expect(errorSpy.mock.calls.length).toBe(launcherLogged);
      });
    }
  }

  it('rejects an invalid outer payload like an invalid JSON string', async () => {
    let mod = await loadModule(path.join(dir, 'default-export.mjs'));
    let invoke = createInvoker(mod, { path: 'default-export.mjs', kind: 'module' });
    expect(await invoke('{broken')).toEqual({
      statusCode: 400,
      body: { error: { code: 'function_bay.launcher', message: 'Invalid JSON payload' } }
    });
  });

  it('prefers a custom export name when it is a function', async () => {
    await fs.writeFile(
      path.join(dir, 'custom-export.mjs'),
      `export default async () => 'default'; export let run = async data => ({ run: data });`
    );
    let mod = await loadModule(path.join(dir, 'custom-export.mjs'));
    let invoke = createInvoker(mod, {
      path: 'custom-export.mjs',
      export: 'run',
      kind: 'module'
    });
    expect(await invoke('{"x":1}')).toEqual({
      statusCode: 200,
      body: { result: { run: { x: 1 } } }
    });
  });
});

describe('enveloped bundles', () => {
  for (let fixture of ['default-export.mjs', 'function-bay-error.mjs', 'plain-error.mjs']) {
    for (let [label, payload] of payloads.slice(0, 4)) {
      it(`passes ${fixture} with ${label} payload through the bundled launcher`, async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        let expected = await runLauncher(fixture, payload);

        let launcherFile = path.join(dir, `launcher-${fixture}.mjs`);
        let mod = await loadModule(launcherFile);
        let invoke = createInvoker(mod, { path: launcherFile, kind: 'enveloped' });
        expect(jsonRoundTrip(await invoke(JSON.stringify(payload)))).toEqual(expected);
      });
    }
  }

  it('reports a launcher failure in the Lambda runtime error shape', async () => {
    let invoke = createInvoker(
      {
        handler: async () => {
          throw new RangeError('launcher broke');
        }
      },
      { path: 'x', kind: 'enveloped' }
    );
    let result: any = await invoke('{}');
    expect(result.errorType).toBe('RangeError');
    expect(result.errorMessage).toBe('launcher broke');
    expect(Array.isArray(result.trace)).toBe(true);
  });
});
