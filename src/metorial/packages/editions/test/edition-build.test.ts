import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  symlinkSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

let cli = resolve(__dirname, '../src/tooling/cli.ts');
let editionsPackage = resolve(__dirname, '..');
let fixture = resolve(__dirname, 'fixtures/workspace');
let entry = '@fixture/app';
let workspace = '';

let prepareWorkspace = () => {
  let directory = mkdtempSync(join(tmpdir(), 'editions-workspace-'));
  cpSync(fixture, directory, { recursive: true });

  mkdirSync(join(directory, 'node_modules/@fixture'), { recursive: true });
  mkdirSync(join(directory, 'node_modules/@metorial'), { recursive: true });

  for (let name of readdirSync(join(directory, 'packages'))) {
    symlinkSync(
      join(directory, 'packages', name),
      join(directory, 'node_modules/@fixture', name)
    );
  }

  symlinkSync(editionsPackage, join(directory, 'node_modules/@metorial/editions'));

  return directory;
};

beforeAll(() => {
  workspace = prepareWorkspace();
});

let run = (args: string[]) =>
  spawnSync('bun', [cli, ...args], { cwd: workspace, encoding: 'utf8' });

let build = (edition: string) => {
  let outdir = mkdtempSync(join(tmpdir(), `editions-${edition}-`));
  let result = run([
    'build',
    join(workspace, 'packages/app/src/main.ts'),
    '--edition',
    edition,
    '--outdir',
    outdir
  ]);

  expect(result.status, result.stderr).toBe(0);

  let bundle = readFileSync(join(outdir, 'main.mjs'), 'utf8');

  return { outdir, bundle };
};

describe('edition builds', () => {
  it('omits on-prem-only code from the cloud bundle', () => {
    let { bundle } = build('cloud');

    expect(bundle).toContain('CLOUD_ONLY_CHARGE');
    expect(bundle).toContain('cloud.example.com');
    expect(bundle).not.toContain('ON_PREM_ONLY_LICENSE');
    expect(bundle).not.toContain('on-prem.example.com');
  });

  it('omits cloud-only code from the on-prem bundle', () => {
    let { bundle } = build('on-prem');

    expect(bundle).toContain('ON_PREM_ONLY_LICENSE');
    expect(bundle).toContain('on-prem.example.com');
    expect(bundle).not.toContain('CLOUD_ONLY_CHARGE');
    expect(bundle).not.toContain('CLOUD_ONLY_SIDE_EFFECT');
    expect(bundle).not.toContain('cloud.example.com');
  });

  it('verifies bundles through their sourcemaps', () => {
    let { outdir } = build('on-prem');
    expect(readdirSync(outdir)).toContain('main.mjs.map');

    let ok = run(['verify', '--edition', 'on-prem', '--sourcemaps', outdir]);
    expect(ok.status, ok.stderr).toBe(0);
  });
});

describe('edition verify', () => {
  it('fails when a cloud-only package is reachable from an on-prem entry', () => {
    let result = run(['verify', '--edition', 'on-prem', '--entry', entry]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('@fixture/cloud-only');
    expect(result.stderr).toContain('@fixture/app -> @fixture/shared -> @fixture/cloud-only');
  });

  it('fails when a bundle contains a package of another edition', () => {
    let { outdir } = build('cloud');
    let result = run(['verify', '--edition', 'on-prem', '--sourcemaps', outdir]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('@fixture/cloud-only');
  });
});
