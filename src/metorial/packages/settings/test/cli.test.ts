import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

let cli = resolve(__dirname, '../src/cli.ts');
let fixture = resolve(__dirname, 'fixtures/settings-module.ts');

let run = (args: string[]) =>
  spawnSync('bun', [cli, ...args, fixture], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '' }
  });

describe('metorial-settings cli', () => {
  it('groups missing values by who has to provide them', () => {
    let result = run(['check', '--edition', 'on-prem']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Must be provided by the customer:');
    expect(result.stderr).toContain('links.publicUrl (FIXTURE_PUBLIC_URL)');
    expect(result.stderr).toContain('Missing from the deployment');
    expect(result.stderr).toContain('links.internalUrl (FIXTURE_INTERNAL_URL)');
    expect(result.stderr).not.toContain('trustedDomains');
  });

  it('passes with a config file using group and camelCase keys', () => {
    let dir = mkdtempSync(join(tmpdir(), 'settings-cli-'));
    let path = join(dir, 'config.json');

    writeFileSync(
      path,
      JSON.stringify({
        links: {
          publicUrl: 'https://metorial.example.com',
          internalUrl: 'http://controller:3000'
        }
      })
    );

    let result = run(['check', '--edition', 'on-prem', '--config', path]);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('valid for the on-prem edition');
  });

  it('renders an example config with only the customer settings', () => {
    let result = run(['example', '--edition', 'on-prem']);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('links:');
    expect(result.stdout).toContain('publicUrl: "REPLACE_ME"');
    expect(result.stdout).toContain('trustedDomains: []');
    expect(result.stdout).toContain('# required, env: FIXTURE_PUBLIC_URL');
    expect(result.stdout).not.toContain('apiUrl');
    expect(result.stdout).not.toContain('token');
  });

  it('exports a schema that flags secrets and edition defaults', () => {
    let result = run(['schema', '--edition', 'cloud', '--audience', 'customer']);
    let schema = JSON.parse(result.stdout);

    expect(schema.edition).toBe('cloud');
    expect(schema.settings.map((s: any) => s.key).sort()).toEqual([
      'publicUrl',
      'trustedDomains'
    ]);
    expect(schema.settings.find((s: any) => s.key == 'trustedDomains').defaultValue).toEqual([
      'metorial.com'
    ]);
  });
});
