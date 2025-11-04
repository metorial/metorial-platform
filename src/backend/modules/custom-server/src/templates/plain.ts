import { ensureTemplate } from './base';

ensureTemplate({
  name: 'Basic TypeScript',
  slug: 'plain-typescript',
  contents: [
    {
      path: 'package.json',
      content: JSON.stringify(
        {
          name: 'plain-typescript',
          version: '1.0.0',
          main: 'server.ts',
          devDependencies: {
            typescript: 'latest'
          },
          dependencies: {
            '@metorial/mcp-server-sdk': 'latest',
            metorial: 'latest',
            '@types/node': 'latest',
            '@modelcontextprotocol/sdk': '^1.18.2',
            zod: '3'
          }
        },
        null,
        2
      )
    },
    {
      path: 'tsconfig.json',
      content: JSON.stringify(
        {
          $schema: 'https://json.schemastore.org/tsconfig',
          display: 'Default',
          compilerOptions: {
            composite: false,
            declaration: true,
            declarationMap: true,
            esModuleInterop: true,
            forceConsistentCasingInFileNames: true,
            inlineSources: false,
            isolatedModules: true,
            moduleResolution: 'node',
            noEmit: true,
            lib: ['ESNext'],
            target: 'ESNext',
            noUnusedLocals: false,
            noUnusedParameters: false,
            preserveWatchOutput: true,
            skipLibCheck: true,
            strict: true,
            downlevelIteration: true,
            resolveJsonModule: true,
            types: ['node']
          },
          exclude: ['node_modules']
        },
        null,
        2
      )
    },
    {
      path: 'metorial.json',
      content: JSON.stringify(
        {
          name: 'TypeScript MCP Server',
          runtime: 'typescript.node'
        },
        null,
        2
      )
    },
    {
      path: 'server.ts',
      content: `import { metorial } from '@metorial/mcp-server-sdk';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

interface Config {
  // OAuth Token is provided as 'token'
  // token: string;
}

metorial.createServer<Config>(
  {
    name: 'demo-server',
    version: '1.0.0'
  },
  async (server, args) => {
    server.registerTool(
      'add',
      {
        title: 'Addition Tool',
        description: 'Add two numbers',
        inputSchema: { a: z.number(), b: z.number() }
      },
      async ({ a, b }) => ({
        content: [{ type: 'text', text: String(a + b) }]
      })
    );

    server.registerResource(
      'greeting',
      new ResourceTemplate('greeting://{name}', { list: undefined }),
      {
        title: 'Greeting Resource',
        description: 'Dynamic greeting generator'
      },
      async (uri, { name }) => ({
        contents: [
          {
            uri: uri.href,
            text: \`Hello, \${name}!\`
          }
        ]
      })
    );
  }
);
`
    }
  ]
});
