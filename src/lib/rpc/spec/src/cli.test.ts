import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import { parseArgs, run } from './cli';

let fixture = new URL('./fixtures/bucket.ts', import.meta.url).pathname;

describe('parseArgs', () => {
  test('reads the spec and flags', () => {
    expect(
      parseArgs(['generate', 'spec.ts', '--go', 'out', '--ts', 'a.ts', '--check'])
    ).toEqual({
      spec: 'spec.ts',
      go: 'out',
      ts: 'a.ts',
      check: true
    });
  });

  test('rejects missing outputs and unknown flags', () => {
    expect(() => parseArgs(['generate', 'spec.ts'])).toThrow(/--go and\/or --ts/);
    expect(() => parseArgs(['generate', 'spec.ts', '--go'])).toThrow(/needs a value/);
    expect(() => parseArgs(['generate', 'spec.ts', '--nope', 'x'])).toThrow(
      /Unexpected argument/
    );
    expect(() => parseArgs(['build', 'spec.ts'])).toThrow(/Usage/);
  });
});

describe('run', () => {
  test('writes the Go package and TS client, and --check detects drift', async () => {
    let dir = await mkdtemp(join(tmpdir(), 'rpc-spec-'));
    let goDir = join(dir, 'go');
    let tsFile = join(dir, 'ts', 'generated.ts');
    let errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    let args = ['generate', fixture, '--go', goDir, '--ts', tsFile];
    expect(await run([...args, '--check'])).toBe(1);
    expect(errors.mock.calls[0]![0]).toContain('bucketrpc.gen.go');

    expect(await run(args)).toBe(0);
    expect(await readFile(join(goDir, 'bucketrpc.gen.go'), 'utf8')).toContain(
      'package bucketrpc'
    );
    expect(await readFile(tsFile, 'utf8')).toContain('export type CodeBucketClient');
    expect(await run([...args, '--check'])).toBe(0);

    await writeFile(tsFile, 'stale');
    expect(await run([...args, '--check'])).toBe(1);
  });

  test('requires a default-exported service spec', async () => {
    let dir = await mkdtemp(join(tmpdir(), 'rpc-spec-'));
    let spec = join(dir, 'spec.ts');
    await writeFile(spec, 'export default { nope: true };');

    await expect(run(['generate', spec, '--ts', join(dir, 'out.ts')])).rejects.toThrow(
      /must default-export a service\(\) spec/
    );
  });
});
