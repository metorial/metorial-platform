import { isServiceError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import type {
  ServerAuthConfig,
  ServerConfig,
  ServerConnection,
  ServerVersion,
  Tenant
} from '../../../prisma/generated/client';
import { isEgressPolicyError } from '../../lib/network/egressPolicy';
import { ConnectionError, HttpResponseError } from './connectionError';

let Sentry = getSentry();

export interface ConnectionIssueContext {
  transport: 'sse' | 'streamable_http' | 'stateless' | 'discovery' | 'auth_manager';
  phase: string;
  remoteUrl?: string | null;
  remoteProtocol?: string | null;
  connectionId?: string;
  serverId?: string;
  serverVersionId?: string;
  serverConfigId?: string;
  authConfigId?: string;
  tenantId?: string;
  [key: string]: unknown;
}

let NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ECONNABORTED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'EPIPE',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ConnectionRefused',
  'ConnectionClosed',
  'FailedToOpenSocket',
  'UnableToConnect',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'CERT_HAS_EXPIRED',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'ABORT_ERR'
]);

let NETWORK_ERROR_MESSAGE =
  /fetch failed|socket|network|terminated|timed? ?out|\btls\b|certificate|\bssl\b|dns|getaddrinfo|unable to connect|connection (closed|refused|reset)|stream closed|unexpected eof|invalid url|content-type|aborted/i;

/**
 * Failures caused by the remote server, the network, or the user's own
 * configuration. These are surfaced to the user through the connection error
 * channel and are not actionable for us, so they must not reach Sentry.
 */
export let isExpectedConnectionFailure = (error: unknown) => {
  if (error instanceof ConnectionError) return true;
  if (error instanceof HttpResponseError) return true;
  if (error instanceof McpError) return true;
  if (isEgressPolicyError(error)) return true;
  if (isServiceError(error)) return true;

  let name = (error as { name?: unknown } | null)?.name;
  if (name == 'AbortError' || name == 'TimeoutError' || name == '$ZodError') return true;

  let code = (error as { code?: unknown } | null)?.code;
  if (typeof code == 'string' && (NETWORK_ERROR_CODES.has(code) || code.startsWith('UND_ERR_'))) {
    return true;
  }

  let message = (error as { message?: unknown } | null)?.message;
  return typeof message == 'string' && NETWORK_ERROR_MESSAGE.test(message);
};

export let reportConnectionIssue = (error: unknown, context: ConnectionIssueContext) => {
  if (isExpectedConnectionFailure(error)) return;

  let { transport, phase, ...extra } = context;

  Sentry.captureException(error, {
    tags: {
      transport,
      phase,
      remoteProtocol: context.remoteProtocol ?? undefined
    },
    extra
  });
};

export interface RemoteConnectionIssueSource {
  transport: 'sse' | 'streamable_http' | 'stateless';
  tenant: Pick<Tenant, 'id'>;
  version: Pick<ServerVersion, 'id' | 'remoteUrl' | 'remoteProtocol'>;
  connection: Pick<ServerConnection, 'id'> & {
    serverConfig: Pick<ServerConfig, 'id'>;
    serverAuthConfig: Pick<ServerAuthConfig, 'id' | 'type'> | null;
  };
}

export let reportRemoteConnectionIssue = (
  error: unknown,
  phase: string,
  source: RemoteConnectionIssueSource
) =>
  reportConnectionIssue(error, {
    transport: source.transport,
    phase,
    remoteUrl: source.version.remoteUrl,
    remoteProtocol: source.version.remoteProtocol,
    connectionId: source.connection.id,
    serverVersionId: source.version.id,
    serverConfigId: source.connection.serverConfig.id,
    authConfigId: source.connection.serverAuthConfig?.id,
    authType: source.connection.serverAuthConfig?.type,
    tenantId: source.tenant.id
  });
