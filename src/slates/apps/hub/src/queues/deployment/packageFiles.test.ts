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
});
