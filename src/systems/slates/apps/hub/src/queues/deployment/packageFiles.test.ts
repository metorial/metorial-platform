import { describe, expect, it } from 'vitest';
import { buildSlateDeploymentFiles } from './packageFiles';

let getFile = (
  files: { filename: string; content: string; encoding?: 'utf-8' | 'base64' }[],
  filename: string
) => {
  let file = files.find(file => file.filename === filename);
  expect(file).toBeDefined();
  return file!;
};

describe('buildSlateDeploymentFiles', () => {
  it('builds an unbuilt slate around the source entrypoint and merged dependencies', () => {
    let result = buildSlateDeploymentFiles([
      {
        path: 'package.json',
        buffer: Buffer.from(
          JSON.stringify({
            name: '@scope/unbuilt-slate',
            version: '1.0.0',
            dependencies: {
              lodash: '^4.17.21'
            },
            scripts: {
              build: 'tsc -p tsconfig.json'
            }
          })
        )
      },
      {
        path: 'src/index.ts',
        buffer: Buffer.from('export let provider = {};')
      },
      {
        path: 'logo.png',
        buffer: Buffer.from('ignored')
      }
    ]);

    expect(result.slateEntrypoint).toBe('src/index.ts');

    let packageJson = JSON.parse(getFile(result.files, 'package.json').content);
    expect(packageJson.dependencies).toMatchObject({
      lodash: '^4.17.21',
      '@slates/provider-handler': 'latest',
      '@slates/proto': 'latest',
      slates: 'latest',
      '@lowerdeck/serialize': 'latest'
    });

    let functionBayJson = JSON.parse(getFile(result.files, 'function-bay.json').content);
    expect(functionBayJson).toMatchObject({
      entrypoint: 'slates_entry_point.js'
    });
    expect(functionBayJson.scripts).toBeUndefined();

    expect(getFile(result.files, 'slates_entry_point.js').content).toContain(
      "import { provider } from './src/index.ts';"
    );
    expect(result.files.some(file => file.filename === 'logo.png')).toBe(false);
  });

  it('prefers the prebuilt dist entrypoint and keeps sourcemap files', () => {
    let result = buildSlateDeploymentFiles([
      {
        path: 'package.json',
        buffer: Buffer.from(
          JSON.stringify({
            name: '@scope/prebuilt-slate',
            version: '2.0.0',
            main: 'dist/index.js'
          })
        )
      },
      {
        path: 'src/index.ts',
        buffer: Buffer.from('export let provider = "source";')
      },
      {
        path: 'dist/index.js',
        buffer: Buffer.from('export let provider = "dist";\n//# sourceMappingURL=index.js.map')
      },
      {
        path: 'dist/index.js.map',
        buffer: Buffer.from('{"version":3,"file":"index.js"}')
      }
    ]);

    expect(result.slateEntrypoint).toBe('dist/index.js');
    expect(getFile(result.files, 'slates_entry_point.js').content).toContain(
      "import { provider } from './dist/index.js';"
    );

    let functionBayJson = JSON.parse(getFile(result.files, 'function-bay.json').content);
    expect(functionBayJson).toMatchObject({
      entrypoint: 'slates_entry_point.js',
      scripts: {
        build: expect.stringContaining('Skipping slate build')
      }
    });

    let mapFile = getFile(result.files, 'dist/index.js.map');
    expect(mapFile.encoding).toBe('base64');
    expect(Buffer.from(mapFile.content, 'base64').toString('utf-8')).toContain(
      '"file":"index.js"'
    );
  });

  it('uses packed dist output instead of rebuilding a source main', () => {
    let result = buildSlateDeploymentFiles([
      {
        path: 'package.json',
        buffer: Buffer.from(
          JSON.stringify({
            name: '@scope/prebuilt-slate-with-source-main',
            version: '3.0.0',
            main: 'src/index.ts',
            scripts: {
              build: 'bunx @vercel/ncc build src/index.ts -o dist -m -s'
            }
          })
        )
      },
      {
        path: 'src/index.ts',
        buffer: Buffer.from('export let provider = "source";')
      },
      {
        path: 'dist/index.js',
        buffer: Buffer.from('export let provider = "dist";')
      }
    ]);

    expect(result.slateEntrypoint).toBe('dist/index.js');
    expect(getFile(result.files, 'slates_entry_point.js').content).toContain(
      "import { provider } from './dist/index.js';"
    );

    let functionBayJson = JSON.parse(getFile(result.files, 'function-bay.json').content);
    expect(functionBayJson).toMatchObject({
      entrypoint: 'slates_entry_point.js',
      scripts: {
        build: expect.stringContaining('Skipping slate build')
      }
    });
  });
});
