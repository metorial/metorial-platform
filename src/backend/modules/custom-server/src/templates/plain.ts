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
            metorial: 'latest',
            '@metorial/mcp-server-sdk': 'latest'
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
            esModuleInterop: true,
            inlineSources: false,
            isolatedModules: true,
            target: 'ESNext',
            noUnusedLocals: false,
            noUnusedParameters: false,
            skipLibCheck: true,
            strict: true,
            resolveJsonModule: true
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
          runtime: 'typescript.deno'
        },
        null,
        2
      )
    },
    {
      path: 'server.ts',
      content: `import { z, metorial, McpServer, ResourceTemplate } from '@metorial/mcp-server-sdk';

let config = await metorial.getArgs();

let server = new McpServer({
  name: 'demo-server',
  version: '1.0.0'
});

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

metorial.startServer(server);
`
    }
  ]
});
