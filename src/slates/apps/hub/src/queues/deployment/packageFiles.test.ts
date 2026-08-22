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

  it('uses handler exports from the provider artifact for the bundled wrapper opt-in', () => {
    let result = buildSlateDeploymentFiles([
      toArchiveFile(
        'package.json',
        JSON.stringify({
          name: 'slate',
          main: 'dist/index.js',
          dependencies: {
            existing: '1.0.0',
            '@slates/provider-handler': '0.1.0',
            '@slates/proto': '0.1.0',
            slates: '0.1.0'
          },
          slatesRuntime: { wrapper: 'bundled' }
        })
      ),
      toArchiveFile(
        'dist/index.js',
        'export let provider = {}; export let createProviderHandler = () => {}; export let SlatesProviderProtoHandlerManager = {};'
      ),
      toArchiveFile('src/index.ts', 'export let provider = {};')
    ]);

    expect(result.providerImportPath).toBe('dist/index.js');

    let entryPoint = result.files.find(file => file.filename === 'slates_entry_point.js')!
      .content as string;
    expect(entryPoint).toContain(
      "import { provider, createProviderHandler, SlatesProviderProtoHandlerManager } from './dist/index.js';"
    );
    expect(entryPoint).not.toContain("from '@slates/provider-handler'");
    expect(entryPoint).not.toContain("from '@slates/proto'");

    let packageJson = JSON.parse(
      result.files.find(file => file.filename === 'package.json')!.content as string
    );
    expect(packageJson.dependencies).toEqual({
      existing: '1.0.0',
      '@lowerdeck/serialize': 'latest'
    });
  });

  it('keeps external handler imports and dependencies without the bundled wrapper opt-in', () => {
    let result = buildSlateDeploymentFiles([
      toArchiveFile(
        'package.json',
        JSON.stringify({
          name: 'slate',
          main: 'dist/index.js'
        })
      ),
      toArchiveFile('dist/index.js', 'export let provider = {};'),
      toArchiveFile('src/index.ts', 'export let provider = {};')
    ]);

    expect(result.providerImportPath).toBe('src/index.ts');

    let entryPoint = result.files.find(file => file.filename === 'slates_entry_point.js')!
      .content as string;
    expect(entryPoint).toContain("import { provider } from './src/index.ts';");
    expect(entryPoint).toContain("from '@slates/provider-handler'");
    expect(entryPoint).toContain("from '@slates/proto'");

    let packageJson = JSON.parse(
      result.files.find(file => file.filename === 'package.json')!.content as string
    );
    expect(packageJson.dependencies).toMatchObject({
      '@slates/provider-handler': 'latest',
      '@slates/proto': 'latest',
      slates: 'latest',
      '@lowerdeck/serialize': 'latest'
    });
  });
});
