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
      toArchiveFile(
        'dist/index.js',
        "import './sourcemap-register.cjs';\nexport let provider = {};"
      ),
      toArchiveFile('dist/sourcemap-register.cjs', 'module.exports = {};'),
      toArchiveFile('dist/index.js.map', '{}'),
      toArchiveFile('src/index.ts', 'export let provider = {};')
    ]);

    expect(result.providerImportPath).toBe('src/index.ts');
    expect(result.files.find(file => file.filename === 'dist/index.js')).toBeUndefined();
    expect(
      result.files.find(file => file.filename === 'dist/sourcemap-register.cjs')
    ).toBeUndefined();

    let packageJson = JSON.parse(
      result.files.find(file => file.filename === 'package.json')!.content as string
    );
    expect(packageJson.type).toBeUndefined();
    expect(packageJson.dependencies).toMatchObject({
      '@slates/provider-handler': '1.0.0-rc.22',
      '@slates/proto': '1.0.0-rc.17',
      slates: '1.0.0-rc.19'
    });

    let entryPoint = result.files.find(
      file => file.filename === 'slates_entry_point.js'
    )!.content;
    expect(entryPoint).toContain("from './src/index.ts'");
    expect(entryPoint).toContain('SLATES_HUB_RUNTIME_IDENTITY_SECRET');
    expect(entryPoint).toContain('SLATES_HUB_RUNTIME_IDENTITY_ID');
    expect(entryPoint).toContain("'x-slates-runtime-identity-id': runtimeIdentityId");
    expect(entryPoint).toContain('deploymentId,');
    expect(entryPoint).toContain('hubInvocationId: input.invocationId');
    expect(entryPoint).not.toContain('process.env.SLATES_HUB_SECRET_RPC_TOKEN');
  });

  it('keeps prebuilt dist when no source entrypoint exists', () => {
    let result = buildSlateDeploymentFiles([
      toArchiveFile('package.json', JSON.stringify({ name: 'slate', main: 'dist/index.js' })),
      toArchiveFile(
        'dist/index.js',
        "import './sourcemap-register.cjs';\nexport let provider = {};"
      )
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

    let packageJson = JSON.parse(
      result.files.find(file => file.filename === 'package.json')!.content as string
    );
    expect(packageJson.dependencies).toMatchObject({
      '@slates/provider-handler': '1.0.0-rc.22',
      slates: '1.0.0-rc.19'
    });
  });

  it('uses runtime exports bundled into a prebuilt slate without installing internal packages', () => {
    let result = buildSlateDeploymentFiles([
      toArchiveFile(
        'package.json',
        JSON.stringify({
          name: 'slate',
          main: 'dist/index.js',
          dependencies: {
            '@slates/provider-handler': 'workspace:*',
            '@slates/proto': 'workspace:*',
            slates: 'workspace:*'
          },
          devDependencies: { '@slates/proto': 'workspace:*' },
          optionalDependencies: { slates: 'workspace:*' },
          peerDependencies: { '@slates/provider-handler': 'workspace:*' },
          bundledDependencies: ['slates'],
          bundleDependencies: ['@slates/proto'],
          slatesRuntime: { wrapper: 'bundled' }
        })
      ),
      toArchiveFile(
        'dist/index.js',
        'export let provider = {}; export let createProviderHandler = {}; export let SlatesProviderProtoHandlerManager = {};'
      ),
      toArchiveFile(
        'src/index.ts',
        'export let provider = {}; // Internal runtime exports intentionally absent.'
      )
    ]);

    expect(result.providerImportPath).toBe('dist/index.js');

    let packageJson = JSON.parse(
      result.files.find(file => file.filename === 'package.json')!.content as string
    );
    expect(packageJson.dependencies).toMatchObject({
      '@lowerdeck/serialize': 'latest',
      '@lowerdeck/rpc-client': 'latest'
    });
    expect(packageJson.dependencies).not.toHaveProperty('@slates/provider-handler');
    expect(packageJson.dependencies).not.toHaveProperty('@slates/proto');
    expect(packageJson.dependencies).not.toHaveProperty('slates');
    expect(packageJson.devDependencies).not.toHaveProperty('@slates/proto');
    expect(packageJson.optionalDependencies).not.toHaveProperty('slates');
    expect(packageJson.peerDependencies).not.toHaveProperty('@slates/provider-handler');
    expect(packageJson.bundledDependencies).not.toContain('slates');
    expect(packageJson.bundleDependencies).not.toContain('@slates/proto');

    let entryPoint = result.files.find(
      file => file.filename === 'slates_entry_point.js'
    )!.content;
    expect(entryPoint).toContain(
      "import { provider, createProviderHandler, SlatesProviderProtoHandlerManager } from './dist/index.js';"
    );
    expect(entryPoint).not.toContain("from '@slates/provider-handler'");
    expect(entryPoint).not.toContain("from '@slates/proto'");
  });
});
