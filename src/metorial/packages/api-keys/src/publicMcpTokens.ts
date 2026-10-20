import { randomBytes } from 'crypto';

export let PUBLIC_MCP_ACCESS_TOKEN_PREFIX = 'metorial_pma_';
export let PUBLIC_MCP_REFRESH_TOKEN_PREFIX = 'metorial_pmr_';

let PUBLIC_MCP_TOKEN_BYTES = 32;

export type PublicMcpTokenType = 'access' | 'refresh';

export let generatePublicMcpToken = (type: PublicMcpTokenType) => {
  let prefix =
    type == 'access' ? PUBLIC_MCP_ACCESS_TOKEN_PREFIX : PUBLIC_MCP_REFRESH_TOKEN_PREFIX;

  return `${prefix}${randomBytes(PUBLIC_MCP_TOKEN_BYTES).toString('base64url')}`;
};

export let getPublicMcpTokenType = (token: string): PublicMcpTokenType | null => {
  if (token.startsWith(PUBLIC_MCP_ACCESS_TOKEN_PREFIX)) return 'access';
  if (token.startsWith(PUBLIC_MCP_REFRESH_TOKEN_PREFIX)) return 'refresh';

  return null;
};

export let isPublicMcpToken = (token: string) => getPublicMcpTokenType(token) !== null;
