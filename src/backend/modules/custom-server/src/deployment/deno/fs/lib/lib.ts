export let libIndexTs = `import { getArgs } from './args.ts';
import {setOauthHandler} from './oauth.ts';

export * from 'npm:@modelcontextprotocol/sdk@1.18.2/server/mcp.js';
export * from 'npm:@modelcontextprotocol/sdk@1.18.2/server/index.js';
export * from 'npm:@modelcontextprotocol/sdk@1.18.2/types.js';
export * from 'npm:zod@3';

export let startMetorialServer = (server: McpServer) => {
  globalThis.__metorial_setServer__(server);
};

export let metorial = {
  setOauthHandler,

  startServer: startMetorialServer,
  getArgs,

  get arguments() {
    return getArgs();
  },
  get args() {
    return getArgs();
  },
  
  withArgs: async (cb: (args: any) => void) => {
    let args = await getArgs();
    await cb(args);
  }
}
`;
