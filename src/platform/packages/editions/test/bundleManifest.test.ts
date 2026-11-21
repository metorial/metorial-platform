import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { rollupBundleContents, type BundleManifest } from '../src/tooling/bundleManifest';
import { buildEdition } from '../src/tooling/build';

let writeFiles = (root: string, files: Record<string, string>) => {
  for (let [path, contents] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
};

describe('bundle manifests', () => {
  it('records the bundled inputs and the imports left for runtime', async () => {
    let root = realpathSync(mkdtempSync(join(tmpdir(), 'bundle-manifest-')));
    writeFiles(root, {
      'node_modules/left-pad/package.json': '{"name":"left-pad","version":"1.3.0"}',
      'node_modules/left-pad/index.js': 'module.exports = value => `  ${value}`;',
      'node_modules/unused/package.json': '{"name":"unused","version":"1.0.0"}',
      'node_modules/unused/index.js': 'module.exports = 1;',
      'app/main.ts': [
        "import { readFileSync } from 'node:fs';",
        "import pad from 'left-pad';",
        "import { client } from 's3-client';",
        'let native; try { native = require("optional-native"); } catch {}',
        'console.log(pad(String(readFileSync)), native, client);'
      ].join('\n')
    });

    let manifestPath = join(root, 'app/dist/bundle-manifest/main.json');
    let cwd = process.cwd();
    process.chdir(join(root, 'app'));

    try {
      await buildEdition({
        entry: 'main.ts',
        edition: 'on-prem',
        outdir: 'dist',
        external: ['s3-client'],
        bundleManifest: manifestPath
      });
    } finally {
      process.chdir(cwd);
    }

    let manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as BundleManifest;

    expect(manifest.version).toBe(1);
    expect(manifest.inputs).toContain('../../../node_modules/left-pad/index.js');
    expect(manifest.inputs).toContain('../../main.ts');
    expect(manifest.inputs.some(input => input.includes('unused'))).toBe(false);
    expect(manifest.externals).toEqual(
      expect.arrayContaining(['node:fs', 'optional-native', 's3-client'])
    );
  });

  it('keeps only rendered files of rollup chunks', () => {
    let contents = rollupBundleContents({
      'index.js': {
        type: 'chunk',
        modules: {
          '/app/node_modules/dompurify/dist/purify.es.mjs': { renderedLength: 120 },
          '/app/node_modules/tree-shaken/index.js': { renderedLength: 0 },
          '\0/app/node_modules/react/index.js?commonjs-module': { renderedLength: 40 },
          '\0vite/preload-helper.js': { renderedLength: 10 }
        }
      },
      'style.css': { type: 'asset' }
    });

    expect(contents.inputs).toEqual([
      '/app/node_modules/dompurify/dist/purify.es.mjs',
      '/app/node_modules/react/index.js'
    ]);
  });
});
