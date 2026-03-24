export {
  createMcpServer,
  type McpServerInstance,
  type McpServerInstanceOpts,
  type McpServerInstanceServer
} from './instance';

export {
  clientAdapter,
  serverAdapter,
  type McpServerInstanceAdapterResponses,
  type McpServerInstanceMessage
} from './adapter';

export {
  createOAuth,
  oAuth,
  type McpServerOAuthCallbackHandler,
  type McpServerOAuthCallbackHandlerParams,
  type McpServerOAuthCallbackHandlerResult,
  type McpServerOAuthConfig,
  type McpServerOAuthTokenRefreshHandler,
  type McpServerOAuthTokenRefreshHandlerParams,
  type McpServerOAuthTokenRefreshHandlerResult,
  type McpServerOAuthUrlHandler,
  type McpServerOAuthUrlHandlerInternal,
  type McpServerOAuthUrlHandlerParams,
  type McpServerOAuthUrlHandlerResult,
  type McpServerOAuthValue
} from './auth';

export { config, createConfig, type McpServerConfig } from './config';

export {
  McpTool,
  type McpServerInfo,
  type McpToolAnnotations,
  type McpToolHandlerOutput,
  type McpToolHandlerOutputSync,
  type McpToolImplementation,
  type McpToolOpts
} from '@metorial/mcp';
