export let PUBLIC_MCP_AUTHORIZATION_TTL_MINUTES = 30;
export let PUBLIC_MCP_AUTHORIZATION_CODE_TTL_MINUTES = 10;
export let PUBLIC_MCP_CLIENT_IDLE_TTL_DAYS = 90;

export let PUBLIC_MCP_MAX_REDIRECT_URIS = 10;
export let PUBLIC_MCP_MAX_CLIENT_NAME_LENGTH = 200;

export let PUBLIC_MCP_SCOPE = 'mcp';

export let PUBLIC_MCP_BINDING_COOKIE_PREFIX = '__Host-metorial_public_mcp_';

export let PUBLIC_MCP_RATE_LIMITS = {
  registerPerIp: { max: 20, windowSeconds: 60 * 60 },
  registerPerServer: { max: 500, windowSeconds: 60 * 60 },
  authorizePerIp: { max: 60, windowSeconds: 10 * 60 },
  completePerIp: { max: 60, windowSeconds: 10 * 60 },
  tokenPerIp: { max: 120, windowSeconds: 10 * 60 },
  requestsPerGrant: { max: 1200, windowSeconds: 60 }
};
