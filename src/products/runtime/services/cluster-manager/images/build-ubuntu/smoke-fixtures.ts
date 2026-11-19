// Writes the projects smoke-test.sh builds offline: bun smoke-fixtures.ts <output directory>
import fs from 'fs/promises';
import path from 'path';
import { getFunctionFs } from '../../../../../integrations/services/mcp-runtime/packages/function-bay/src/function/getFs';
import { buildSlateDeploymentFiles } from '../../../../../../slates/apps/hub/src/queues/deployment/packageFiles';

type FixtureFile = { filename: string; content: string; encoding?: 'base64' | 'utf-8' };

let customProviderIndex = `
import { McpTool } from '@metorial/mcp';
import { createMcpServer } from '@metorial/mcp-server';
import z from 'zod';

let add = McpTool.create('add', { description: 'Add two numbers.' })
  .input(z.object({ a: z.number(), b: z.number() }))
  .output(z.object({ result: z.number() }))
  .handle(async input => ({ result: input.a + input.b }));

export let server = createMcpServer({ name: 'Smoke Test', version: '1.0.0', tools: [add] });

export default server;
`;

let customProviderPackageJson = (dependencies: Record<string, string>) =>
  JSON.stringify({
    name: 'smoke-test',
    private: true,
    type: 'module',
    version: '1.0.0',
    main: 'index.ts',
    dependencies
  });

let customProvider = (dependencies: Record<string, string>) => {
  let result = getFunctionFs({
    payload: {
      runtime: { identifier: 'nodejs', version: '24.x' },
      env: {},
      files: [
        { filename: 'package.json', content: customProviderPackageJson(dependencies) },
        { filename: 'index.ts', content: customProviderIndex }
      ]
    } as any
  });
  if (!result.ok) throw new Error(result.logs.join('\n'));

  return result.files as FixtureFile[];
};

let prebuiltSlate = () =>
  buildSlateDeploymentFiles([
    {
      path: 'package.json',
      buffer: Buffer.from(
        JSON.stringify({
          name: 'smoke-test-slate',
          version: '1.0.0',
          main: 'dist/index.js',
          dependencies: { axios: '^1.13.2', slates: '^1.0.0' }
        })
      )
    },
    {
      path: 'dist/index.js',
      buffer: Buffer.from('module.exports.provider = { spec: {}, actions: [] };\n')
    }
  ]).files as FixtureFile[];

let fixtures: Record<string, FixtureFile[]> = {
  'custom-provider': customProvider({
    '@metorial/mcp': 'latest',
    '@metorial/mcp-server': 'latest',
    zod: 'latest'
  }),
  'prebuilt-slate': prebuiltSlate(),
  'custom-provider-missing-package': customProvider({
    '@metorial/mcp-server': 'latest',
    'left-pad': '^1.3.0'
  })
};

let output = process.argv[2];
if (!output) throw new Error('Usage: bun smoke-fixtures.ts <output directory>');

for (let [name, files] of Object.entries(fixtures)) {
  for (let file of files) {
    let target = path.join(output, name, file.filename);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(
      target,
      file.encoding == 'base64' ? Buffer.from(file.content, 'base64') : file.content
    );
  }
}
