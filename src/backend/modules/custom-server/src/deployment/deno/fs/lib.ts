export let libTs = `import { currentServer } from "./server.ts";
import { getArgs } from "./args.ts";

export * from '@modelcontextprotocol/sdk/server/mcp.js';
export * from '@modelcontextprotocol/sdk/server/index.js';
export * from '@modelcontextprotocol/sdk/types.js';

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
