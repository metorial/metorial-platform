import {
  MetorialMcpSession,
  MetorialMcpSessionInit,
  MetorialMcpToolManager
} from '@metorial/mcp-session';
import { Metorial } from '@metorial/sdk';

export let createMcpSdk =
  <I = void>() =>
  <T>(
    handler: (d: {
      session: MetorialMcpSession;
      tools: MetorialMcpToolManager;
      input: I;
    }) => Promise<T>
  ) => {
    let ofSession = async (session: MetorialMcpSession, input: I) => {
      let tools = await session.getToolManager();

      return handler({
        session,
        tools,
        input
      });
    };

    let ofSdk = async (sdk: Metorial, init: MetorialMcpSessionInit, input: I) => {
      let session = sdk.mcp.createSession(init);
      return ofSession(session, input as I);
    };

    return Object.assign(ofSession, {
      ofSession,
      ofSdk
    });
  };
