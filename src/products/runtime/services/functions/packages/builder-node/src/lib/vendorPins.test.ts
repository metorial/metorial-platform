import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { partitionDependencies, type VendorManifest } from './vendor';

let vendorDirectory = path.resolve(__dirname, '../../vendor');
let sdkDirectory = path.resolve(
  __dirname,
  '../../../../../../../integrations/services/mcp-runtime/sdk/packages'
);

let readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf-8'));

let dependencies: Record<string, string> = readJson(
  path.join(vendorDirectory, 'dependencies.json')
).dependencies;

let lockfile = readJson(path.join(vendorDirectory, 'package-lock.json'));

let lockedManifest: VendorManifest = {
  packages: Object.fromEntries(
    Object.entries(lockfile.packages as Record<string, { version: string }>)
      .filter(([key]) => key.startsWith('node_modules/'))
      .map(([key, value]) => [key.slice('node_modules/'.length), value.version] as const)
      .filter(([name]) => !name.includes('/node_modules/'))
  )
};

describe('vendor package set', () => {
  it('pins every package to an exact version', () => {
    for (let spec of Object.values(dependencies)) {
      expect(spec).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?$/);
    }
  });

  it('matches its lockfile', () => {
    expect(lockfile.packages[''].dependencies).toEqual(dependencies);

    for (let [name, version] of Object.entries(dependencies)) {
      expect(lockedManifest.packages[name]).toBe(version);
    }
  });

  it('ships the MCP SDK versions of this checkout', () => {
    let sdkPackages = fs
      .readdirSync(sdkDirectory)
      .map(dir => readJson(path.join(sdkDirectory, dir, 'package.json')))
      .filter(pkg => pkg.name?.startsWith('@metorial/mcp'));

    expect(sdkPackages.length).toBeGreaterThan(0);

    for (let pkg of sdkPackages) {
      expect({ name: pkg.name, version: dependencies[pkg.name] }).toEqual({
        name: pkg.name,
        version: pkg.version
      });
    }
  });

  it('covers the dashboard templates, the slates wrapper and the on-prem function provider e2e', () => {
    let consumers: Record<string, string>[] = [
      { '@metorial/mcp': 'latest', '@metorial/mcp-server': 'latest', zod: 'latest' },
      {
        '@slates/provider-handler': 'latest',
        '@slates/proto': 'latest',
        '@lowerdeck/serialize': 'latest'
      },
      {
        '@metorial/mcp-server': '1.0.0-rc.12',
        '@modelcontextprotocol/sdk': '^1.25.3',
        zod: '^4.3.6'
      }
    ];

    for (let consumer of consumers) {
      expect(
        partitionDependencies({ dependencies: consumer }, lockedManifest).missing
      ).toEqual([]);
    }
  });
});
