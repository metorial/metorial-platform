import fs from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  installVendorPackages,
  partitionDependencies,
  planDependencyInstall,
  readVendorManifest
} from './vendor';

let manifest = {
  packages: {
    '@metorial/mcp': '1.0.0-rc.2',
    '@metorial/mcp-server': '1.0.0-rc.12',
    express: '5.3.0',
    zod: '4.6.7'
  }
};

let workDir: string;

beforeEach(async () => {
  workDir = await fs.mkdtemp(path.join(tmpdir(), 'builder-node-vendor-'));
});

afterEach(async () => {
  await fs.rm(workDir, { recursive: true, force: true });
});

describe('partitionDependencies', () => {
  it('covers dist-tags, wildcards and empty specs by name', () => {
    expect(
      partitionDependencies(
        {
          dependencies: { '@metorial/mcp': 'latest', zod: 'next' },
          devDependencies: { express: '*' },
          optionalDependencies: { '@metorial/mcp-server': '' }
        },
        manifest
      )
    ).toEqual({
      covered: ['@metorial/mcp', 'zod', 'express', '@metorial/mcp-server'],
      missing: []
    });
  });

  it('covers semver ranges the preinstalled version satisfies', () => {
    expect(
      partitionDependencies(
        {
          dependencies: {
            '@metorial/mcp-server': '^1.0.0-rc.11',
            zod: '^4.3.6',
            express: '^4.21.0'
          }
        },
        manifest
      )
    ).toEqual({ covered: ['@metorial/mcp-server', 'zod'], missing: ['express'] });
  });

  it('never covers packages that are not preinstalled', () => {
    expect(
      partitionDependencies({ dependencies: { lodash: 'latest' } }, manifest).missing
    ).toEqual(['lodash']);
  });

  it('never covers local, git, url, alias and GitHub specs', () => {
    let specs = [
      'file:../zod',
      'link:../zod',
      'workspace:*',
      'git+https://github.com/colinhacks/zod.git',
      'git://github.com/colinhacks/zod.git',
      'github:colinhacks/zod',
      'https://registry.example.com/zod.tgz',
      'npm:zod@4.6.7',
      'colinhacks/zod'
    ];

    for (let spec of specs) {
      expect(partitionDependencies({ dependencies: { zod: spec } }, manifest).missing).toEqual(
        ['zod']
      );
    }
  });

  it('treats a package as missing when any field is not covered', () => {
    expect(
      partitionDependencies(
        { dependencies: { zod: 'latest' }, devDependencies: { zod: '^3.0.0' } },
        manifest
      )
    ).toEqual({ covered: [], missing: ['zod'] });
  });
});

describe('planDependencyInstall', () => {
  it('uses the preinstalled packages when every dependency is covered', () => {
    expect(
      planDependencyInstall({
        packageJson: { dependencies: { '@metorial/mcp-server': 'latest', zod: '^4.0.0' } },
        manifest,
        vendorDirectory: '/vendor'
      })
    ).toEqual({ mode: 'vendor', directory: '/vendor', packages: 4 });
  });

  it('uses the preinstalled packages when nothing is declared', () => {
    expect(planDependencyInstall({ packageJson: {}, manifest }).mode).toBe('vendor');
  });

  it('installs and reports the missing packages otherwise', () => {
    expect(
      planDependencyInstall({
        packageJson: { dependencies: { zod: 'latest', lodash: '^4.0.0' } },
        manifest
      })
    ).toEqual({ mode: 'install', missing: ['lodash'] });
  });

  it('installs as before without a vendor manifest', () => {
    expect(
      planDependencyInstall({
        packageJson: { dependencies: { zod: 'latest' } },
        manifest: null
      })
    ).toEqual({ mode: 'install', missing: null });
  });
});

describe('readVendorManifest', () => {
  it('returns null when the image has no vendor directory', async () => {
    expect(await readVendorManifest(path.join(workDir, 'missing'))).toBeNull();
  });

  it('reads the manifest written into the image', async () => {
    await fs.writeFile(path.join(workDir, 'manifest.json'), JSON.stringify(manifest));
    expect(await readVendorManifest(workDir)).toEqual(manifest);
  });
});

describe('installVendorPackages', () => {
  it('copies read-only packages into a writable node_modules', async () => {
    let vendor = path.join(workDir, 'vendor');
    let project = path.join(workDir, 'project');
    let packageDir = path.join(vendor, 'node_modules', 'zod');

    await fs.mkdir(packageDir, { recursive: true });
    await fs.mkdir(project);
    await fs.writeFile(path.join(packageDir, 'package.json'), '{"version":"4.6.7"}');
    await fs.chmod(path.join(packageDir, 'package.json'), 0o444);
    await fs.chmod(packageDir, 0o555);

    try {
      await installVendorPackages({ directory: vendor, cwd: project });

      let copied = path.join(project, 'node_modules', 'zod', 'package.json');
      expect(await fs.readFile(copied, 'utf-8')).toBe('{"version":"4.6.7"}');
      await fs.writeFile(copied, '{}');
      await fs.writeFile(path.join(project, 'node_modules', 'zod', 'extra.js'), '');
    } finally {
      await fs.chmod(packageDir, 0o755);
    }
  });
});
