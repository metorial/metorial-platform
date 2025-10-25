export let libIndexTs = `import { getArgs } from './args.ts';
import { setOauthHandler } from './oauth.ts';
import { setCallbackHandler } from './callbacks.ts';

import { McpServer } from 'npm:@modelcontextprotocol/sdk@1.18.2/server/mcp.js';

export * from 'npm:@modelcontextprotocol/sdk@1.18.2/server/mcp.js';
export * from 'npm:@modelcontextprotocol/sdk@1.18.2/server/index.js';
export * from 'npm:@modelcontextprotocol/sdk@1.18.2/types.js';
export * from 'npm:zod@3';

let createMetorialServer = async (opts: {name: string, version: string}, cb: (server: McpServer, args: string) => unknown) => {
  globalThis.__metorial_setServer__({
    type: 'metorial.server::v1',
    start: async (args: any) => {
      let server = new McpServer(opts);
      await cb(server, args);
      return server;
    }
  })
}

export let metorial = {
  setOauthHandler,
  setCallbackHandler,
  createServer: createMetorialServer
}
`;
