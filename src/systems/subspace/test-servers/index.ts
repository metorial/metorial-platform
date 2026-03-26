import express from 'express';
import { createFullFeaturedServer } from './src/servers/full-featured.js';
import { createToolsOnlyServer } from './src/servers/tools-only.js';
import { createResourcesOnlyServer } from './src/servers/resources-only.js';
import { createPromptsOnlyServer } from './src/servers/prompts-only.js';
import { createResourceTemplatesServer } from './src/servers/resource-templates.js';
import { setupTransports } from './src/shared/transport.js';

const PORT = process.env.PORT || 3000;

async function main() {
  const app = express();

  // Create all test servers
  const servers = [
    { name: 'full-featured', path: '/full', factory: createFullFeaturedServer },
    { name: 'tools-only', path: '/tools', factory: createToolsOnlyServer },
    { name: 'resources-only', path: '/resources', factory: createResourcesOnlyServer },
    { name: 'prompts-only', path: '/prompts', factory: createPromptsOnlyServer },
    { name: 'resource-templates', path: '/templates', factory: createResourceTemplatesServer }
  ];

  // Setup each server with its own path
  for (const { name, path, factory } of servers) {
    await setupTransports(app, factory, path);
    console.log(`✓ ${name} server initialized at ${path}/sse and ${path}/mcp`);
  }

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      servers: servers.map(s => ({
        name: s.name,
        endpoints: {
          sse: `${s.path}/sse`,
          http: `${s.path}/mcp`
        }
      }))
    });
  });

  // Start the server
  app.listen(PORT, () => {
    console.log(`\n🚀 MCP Test Servers running on port ${PORT}\n`);
    console.log('Available servers:');
    servers.forEach(s => {
      console.log(`  • ${s.name}:`);
      console.log(`    - SSE: http://localhost:${PORT}${s.path}/sse`);
      console.log(`    - HTTP: http://localhost:${PORT}${s.path}/mcp`);
    });
    console.log(`\n  Health check: http://localhost:${PORT}/health\n`);
  });
}

main().catch(console.error);
