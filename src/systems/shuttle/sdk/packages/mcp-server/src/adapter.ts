import z from 'zod';
import { McpServerInstance } from './instance';

let discoverMessage = z.object({
  type: z.literal('metorial-mcp.discover')
});
type DiscoverMessage = z.infer<typeof discoverMessage>;

let authUrlMessage = z.object({
  type: z.literal('metorial-mcp.get-oauth-authorization-url'),
  params: z.object({
    authConfig: z.record(z.string(), z.any()),
    clientId: z.string(),
    clientSecret: z.string(),
    state: z.string(),
    redirectUri: z.string()
  })
});
type AuthUrlMessage = z.infer<typeof authUrlMessage>;

let oauthCallbackMessage = z.object({
  type: z.literal('metorial-mcp.handle-oauth-callback'),
  params: z.object({
    authConfig: z.record(z.string(), z.any()),
    authState: z.record(z.string(), z.string()),
    clientId: z.string(),
    clientSecret: z.string(),
    code: z.string(),
    state: z.string(),
    redirectUri: z.string(),
    callbackUrl: z.string(),
    authorizationUrl: z.string()
  })
});
type OauthCallbackMessage = z.infer<typeof oauthCallbackMessage>;

let oauthTokenRefreshMessage = z.object({
  type: z.literal('metorial-mcp.handle-oauth-token-refresh'),
  params: z.object({
    authConfig: z.record(z.string(), z.any()),
    authState: z.record(z.string(), z.string()),
    refreshToken: z.string(),
    clientId: z.string(),
    clientSecret: z.string()
  })
});
type OauthTokenRefreshMessage = z.infer<typeof oauthTokenRefreshMessage>;

let handleMcpMessage = z.object({
  type: z.literal('metorial-mcp.handle-mcp-message'),
  params: z.object({
    authConfig: z.optional(z.record(z.string(), z.any())),
    config: z.record(z.string(), z.any()),
    client: z.object({
      client: z.record(z.string(), z.any()),
      capabilities: z.record(z.string(), z.any())
    }),
    messages: z.array(z.any())
  })
});
type HandleMcpMessage = z.infer<typeof handleMcpMessage>;

let allMessages = z.union([
  discoverMessage,
  authUrlMessage,
  oauthCallbackMessage,
  oauthTokenRefreshMessage,
  handleMcpMessage
]);

export type McpServerInstanceMessage =
  | DiscoverMessage
  | AuthUrlMessage
  | OauthCallbackMessage
  | OauthTokenRefreshMessage
  | HandleMcpMessage;

export let serverAdapter = async (
  instance: McpServerInstance,
  messages: McpServerInstanceMessage[]
) =>
  Promise.all(
    messages.map(async message => {
      let parsed = allMessages.parse(message);

      switch (parsed.type) {
        case 'metorial-mcp.discover': {
          return instance.discover();
        }
        case 'metorial-mcp.get-oauth-authorization-url': {
          return instance.getOauthAuthorizationUrl(parsed.params);
        }
        case 'metorial-mcp.handle-oauth-callback': {
          return instance.handleOauthCallback(parsed.params);
        }
        case 'metorial-mcp.handle-oauth-token-refresh': {
          return instance.handleOauthTokenRefresh(parsed.params);
        }
        case 'metorial-mcp.handle-mcp-message': {
          return instance.handleMcpMessages({
            config: parsed.params.config || {},
            authConfig: parsed.params.authConfig || {},
            client: parsed.params.client as any,
            message: parsed.params.messages
          });
        }
      }

      throw new Error(`Unknown message type: ${(message as any).type}`);
    })
  );

export type McpServerInstanceAdapterResponses = Awaited<ReturnType<typeof serverAdapter>>;

export let clientAdapter = (
  transport: (
    messages: McpServerInstanceMessage[]
  ) => Promise<McpServerInstanceAdapterResponses>
) => {
  let queue: {
    msg: McpServerInstanceMessage;
    resolve: (res: any) => void;
    reject: (err: any) => void;
  }[] = [];
  let isSent = { current: false };
  let isSending = { current: false };

  let send = async (message: McpServerInstanceMessage) => {
    let promise = new Promise<any>((resolve, reject) => {
      queue.push({ msg: message, resolve, reject });
    });

    if (!isSending.current) {
      isSending.current = true;

      setTimeout(async () => {
        isSent.current = true;
        let pending = queue;
        queue = [];
        isSending.current = false;

        try {
          let res = await transport(pending.map(q => q.msg));

          if (res.length !== pending.length) {
            throw new Error(
              `MCP adapter transport returned ${res.length} responses for ${pending.length} messages`
            );
          }

          pending.forEach((q, i) => {
            q.resolve(res[i]);
          });
        } catch (err) {
          pending.forEach(q => {
            q.reject(err);
          });
        }
      }, 2);
    }

    return promise;
  };

  return {
    discover: async () => {
      return send({ type: 'metorial-mcp.discover' }) as Promise<
        Awaited<ReturnType<McpServerInstance['discover']>>
      >;
    },

    getOauthAuthorizationUrl: async (
      d: Parameters<McpServerInstance['getOauthAuthorizationUrl']>[0]
    ) => {
      return send({
        type: 'metorial-mcp.get-oauth-authorization-url',
        params: d
      }) as Promise<Awaited<ReturnType<McpServerInstance['getOauthAuthorizationUrl']>>>;
    },

    handleOauthCallback: async (
      d: Parameters<McpServerInstance['handleOauthCallback']>[0]
    ) => {
      return send({
        type: 'metorial-mcp.handle-oauth-callback',
        params: d
      }) as Promise<Awaited<ReturnType<McpServerInstance['handleOauthCallback']>>>;
    },

    handleOauthTokenRefresh: async (
      d: Parameters<McpServerInstance['handleOauthTokenRefresh']>[0]
    ) => {
      return send({
        type: 'metorial-mcp.handle-oauth-token-refresh',
        params: d
      }) as Promise<Awaited<ReturnType<McpServerInstance['handleOauthTokenRefresh']>>>;
    },

    handleMcpMessages: async (d: Parameters<McpServerInstance['handleMcpMessages']>[0]) => {
      return send({
        type: 'metorial-mcp.handle-mcp-message',
        params: {
          config: d.config,
          authConfig: d.authConfig,
          client: d.client,
          messages: d.message
        }
      }) as Promise<Awaited<ReturnType<McpServerInstance['handleMcpMessages']>>>;
    }
  };
};
