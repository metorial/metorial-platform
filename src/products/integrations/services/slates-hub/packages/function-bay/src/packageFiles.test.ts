import { describe, expect, it } from 'vitest';
import { buildSlateDeploymentFiles } from './packageFiles';

let toArchiveFile = (path: string, content: string) => ({
  path,
  buffer: Buffer.from(content, 'utf-8')
});

describe('buildSlateDeploymentFiles', () => {
  it('prefers source imports over prebuilt dist and drops ncc artifacts', () => {
    let result = buildSlateDeploymentFiles([
      toArchiveFile(
        'package.json',
        JSON.stringify({ name: 'slate', main: 'dist/index.js', type: 'module' })
      ),
      toArchiveFile('dist/index.js', "import './sourcemap-register.cjs';\nexport let provider = {};"),
      toArchiveFile('dist/sourcemap-register.cjs', 'module.exports = {};'),
      toArchiveFile('dist/index.js.map', '{}'),
      toArchiveFile('src/index.ts', 'export let provider = {};')
    ]);

    expect(result.providerImportPath).toBe('src/index.ts');
    expect(result.files.find(file => file.filename === 'dist/index.js')).toBeUndefined();
    expect(result.files.find(file => file.filename === 'dist/sourcemap-register.cjs')).toBeUndefined();

    let packageJson = JSON.parse(
      result.files.find(file => file.filename === 'package.json')!.content as string
    );
    expect(packageJson.type).toBeUndefined();

    let entryPoint = result.files.find(file => file.filename === 'slates_entry_point.js')!.content;
    expect(entryPoint).toContain("from './src/index.ts'");
  });

  it('points dependency installs at a configured npm registry', () => {
    let files = [
      toArchiveFile('package.json', JSON.stringify({ name: 'slate', main: 'src/index.ts' })),
      toArchiveFile('src/index.ts', 'export let provider = {};')
    ];

    expect(
      buildSlateDeploymentFiles(files).files.find(file => file.filename === '.npmrc')
    ).toBeUndefined();

    let result = buildSlateDeploymentFiles(files, {
      npmRegistryUrl: 'http://host.docker.internal:4873/'
    });
    expect(result.files.find(file => file.filename === '.npmrc')?.content).toBe(
      'registry=http://host.docker.internal:4873/\n'
    );
  });

  it('does not abort the message batch on notification errors', () => {
    let result = buildSlateDeploymentFiles([
      toArchiveFile('package.json', JSON.stringify({ name: 'slate', main: 'src/index.ts' })),
      toArchiveFile('src/index.ts', 'export let provider = {};')
    ]);

    let entryPoint = result.files.find(file => file.filename === 'slates_entry_point.js')!.content as string;
    expect(entryPoint).toContain('if (!m.id) continue;');
  });

  it('leaves process-wide state alone so concurrent invocations are unaffected', () => {
    let result = buildSlateDeploymentFiles([
      toArchiveFile('package.json', JSON.stringify({ name: 'slate', main: 'src/index.ts' })),
      toArchiveFile('src/index.ts', 'export let provider = {};')
    ]);

    let entryPoint = result.files.find(file => file.filename === 'slates_entry_point.js')!
      .content as string;
    expect(entryPoint).not.toContain('globalThis');
    expect(entryPoint).not.toContain('require.cache');
    expect(entryPoint).not.toContain('reset(');
  });

  it('keeps prebuilt dist when no source entrypoint exists', () => {
    let result = buildSlateDeploymentFiles([
      toArchiveFile('package.json', JSON.stringify({ name: 'slate', main: 'dist/index.js' })),
      toArchiveFile('dist/index.js', "import './sourcemap-register.cjs';\nexport let provider = {};")
    ]);

    expect(result.providerImportPath).toBe('dist/index.js');

    let distIndex = result.files.find(file => file.filename === 'dist/index.js');
    expect(distIndex).toBeDefined();
    expect(Buffer.from(distIndex!.content as string, 'base64').toString('utf-8')).toBe(
      'export let provider = {};'
    );

    let functionBay = JSON.parse(
      result.files.find(file => file.filename === 'function-bay.json')!.content as string
    );
    expect(functionBay.scripts?.build).toContain('Skipping slate build');
  });

  it('installs only the runtime wrapper for prebuilt slates', () => {
    let result = buildSlateDeploymentFiles([
      toArchiveFile(
        'package.json',
        JSON.stringify({
          name: 'slate',
          version: '2.1.0',
          main: 'dist/index.js',
          type: 'module',
          scripts: { build: 'ncc build src/index.ts -o dist' },
          dependencies: { axios: '^1.13.2', slates: '^1.0.0' },
          devDependencies: { typescript: '^5.9.3' }
        })
      ),
      toArchiveFile('dist/index.js', 'export let provider = {};')
    ]);

    let packageJson = JSON.parse(
      result.files.find(file => file.filename === 'package.json')!.content as string
    );
    expect(packageJson).toEqual({
      name: 'slate',
      version: '2.1.0',
      private: true,
      dependencies: {
        '@slates/provider-handler': 'latest',
        '@slates/proto': 'latest',
        '@lowerdeck/serialize': 'latest'
      }
    });
  });

  it('keeps merging the slate dependencies for source slates', () => {
    let result = buildSlateDeploymentFiles([
      toArchiveFile(
        'package.json',
        JSON.stringify({
          name: 'slate',
          main: 'src/index.ts',
          dependencies: { axios: '^1.13.2' }
        })
      ),
      toArchiveFile('src/index.ts', 'export let provider = {};')
    ]);

    let packageJson = JSON.parse(
      result.files.find(file => file.filename === 'package.json')!.content as string
    );
    expect(packageJson.dependencies).toEqual({
      axios: '^1.13.2',
      '@slates/provider-handler': 'latest',
      '@slates/proto': 'latest',
      '@lowerdeck/serialize': 'latest',
      slates: 'latest'
    });
  });

  it('bundles a registry runtime into prebuilt slates', () => {
    let result = buildSlateDeploymentFiles(
      [
        toArchiveFile(
          'package.json',
          JSON.stringify({ name: 'slate', version: '2.1.0', main: 'dist/index.js' })
        ),
        toArchiveFile('dist/index.js', 'export let provider = {};')
      ],
      {
        runtime: {
          version: '1.4.0',
          main: 'index.js',
          files: [
            toArchiveFile('runtime.json', '{}'),
            toArchiveFile('index.js', 'module.exports = {};')
          ]
        }
      }
    );

    expect(result.runtimeVersion).toBe('1.4.0');

    let packageJson = JSON.parse(
      result.files.find(file => file.filename === 'package.json')!.content as string
    );
    expect(packageJson).toEqual({ name: 'slate', version: '2.1.0', private: true });

    let entryPoint = result.files.find(file => file.filename === 'slates_entry_point.js')!
      .content as string;
    expect(entryPoint).toContain(
      "import { createProviderHandler, SlatesProviderProtoHandlerManager, serialize } from './_slates_runtime/index.js';"
    );
    expect(entryPoint).not.toContain("from '@slates/provider-handler'");

    expect(result.files.map(file => file.filename)).toEqual(
      expect.arrayContaining(['_slates_runtime/index.js', '_slates_runtime/runtime.json'])
    );
  });

  it('ignores the registry runtime for source slates', () => {
    let result = buildSlateDeploymentFiles(
      [
        toArchiveFile('package.json', JSON.stringify({ name: 'slate', main: 'src/index.ts' })),
        toArchiveFile('src/index.ts', 'export let provider = {};')
      ],
      {
        runtime: {
          version: '1.4.0',
          main: 'index.js',
          files: [toArchiveFile('index.js', 'module.exports = {};')]
        }
      }
    );

    expect(result.runtimeVersion).toBeNull();
    expect(result.usesPrebuiltDist).toBe(false);
    expect(result.files.some(file => file.filename.startsWith('_slates_runtime/'))).toBe(
      false
    );

    let entryPoint = result.files.find(file => file.filename === 'slates_entry_point.js')!
      .content as string;
    expect(entryPoint).toContain("from '@slates/provider-handler'");
  });
});
