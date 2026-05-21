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
  it('uses the declared runtime entrypoint and disables Function Bay source builds', () => {
    let result = buildSlateDeploymentFiles([
      {
        path: 'package.json',
        buffer: Buffer.from(
          JSON.stringify({
            name: '@scope/prebuilt-slate',
            version: '1.0.0',
            main: 'dist/index.js',
            dependencies: {
              lodash: '^4.17.21'
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
      },
      {
        path: 'logo.png',
        buffer: Buffer.from('ignored')
      }
    ]);

    expect(result.slateEntrypoint).toBe('dist/index.js');

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
      entrypoint: 'slates_entry_point.mjs',
      build: false
    });
    expect(functionBayJson.scripts).toBeUndefined();

    expect(getFile(result.files, 'slates_entry_point.mjs').content).toContain(
      "import { provider } from './dist/index.js';"
    );
    expect(result.files.some(file => file.filename === 'logo.png')).toBe(false);
  });

  it('uses exports dot as the runtime entrypoint when present', () => {
    let result = buildSlateDeploymentFiles([
      {
        path: 'package.json',
        buffer: Buffer.from(
          JSON.stringify({
            name: '@scope/exported-slate',
            version: '2.0.0',
            main: 'src/index.ts',
            exports: {
              '.': './dist/index.js'
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
        buffer: Buffer.from('export let provider = "dist";\n//# sourceMappingURL=index.js.map')
      },
      {
        path: 'dist/index.js.map',
        buffer: Buffer.from('{"version":3,"file":"index.js"}')
      }
    ]);

    expect(result.slateEntrypoint).toBe('dist/index.js');
    expect(getFile(result.files, 'slates_entry_point.mjs').content).toContain(
      "import { provider } from './dist/index.js';"
    );

    let functionBayJson = JSON.parse(getFile(result.files, 'function-bay.json').content);
    expect(functionBayJson).toMatchObject({
      entrypoint: 'slates_entry_point.mjs',
      build: false
    });
    expect(functionBayJson.scripts).toBeUndefined();

    let mapFile = getFile(result.files, 'dist/index.js.map');
    expect(mapFile.encoding).toBe('base64');
    expect(Buffer.from(mapFile.content, 'base64').toString('utf-8')).toContain(
      '"file":"index.js"'
    );
  });

  it('rejects packages that declare a source entrypoint', () => {
    expect(() =>
      buildSlateDeploymentFiles([
        {
          path: 'package.json',
          buffer: Buffer.from(
            JSON.stringify({
              name: '@scope/source-slate',
              version: '3.0.0',
              main: 'src/index.ts'
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
      ])
    ).toThrow('runtime entrypoint must be a built JavaScript artifact');
  });

  it('does not generate synthetic dist entrypoints', () => {
    let result = buildSlateDeploymentFiles([
      {
        path: 'package.json',
        buffer: Buffer.from(
          JSON.stringify({
            name: '@scope/prebuilt-slate-with-sourcemap-register',
            version: '4.0.0',
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
        buffer: Buffer.from(
          "import './sourcemap-register.cjs';\nexport let provider = 'dist';"
        )
      },
      {
        path: 'dist/sourcemap-register.cjs',
        buffer: Buffer.from('module.exports = {};')
      }
    ]);

    expect(result.slateEntrypoint).toBe('dist/index.js');
    expect(getFile(result.files, 'slates_entry_point.mjs').content).toContain(
      "import { provider } from './dist/index.js';"
    );
    expect(result.files.some(file => file.filename === 'dist/metorial-index.js')).toBe(false);
  });
});
