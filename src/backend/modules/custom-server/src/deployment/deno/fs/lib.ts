export let libTs = `import { currentServer } from "./server.ts";
import { getArgs } from "./args.ts";

export * from 'npm:@modelcontextprotocol/sdk@1.18.2/server/mcp.js';
export * from 'npm:@modelcontextprotocol/sdk@1.18.2/server/index.js';
export * from 'npm:@modelcontextprotocol/sdk@1.18.2/types.js';
export * from 'npm:zod@3';

export let startMetorialServer = (server: McpServer) => {
  currentServer.resolve(server);
};

export let metorial = {
  startServer: startMetorialServer,
  getArgs,

  get arguments() {
    return getArgs();
  },
  get args() {
    return getArgs();
  }
}
`;
