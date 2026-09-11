import type { SessionProvider } from '@metorial-subspace/db';
import { applySessionProviderNameTemplate } from '@metorial-subspace/module-session';
import { buildSyntheticTool } from './syntheticTool';

export let CONNECTION_FAILED_TOOL_KEY = 'connection_failed';

export type ConnectionFailedProvider = SessionProvider & { provider: { name: string } };

export let buildConnectionFailedDetail = (d: {
  provider: ConnectionFailedProvider;
  discoveryError: PrismaJson.ProviderDeploymentConfigPairDiscoveryError | null | undefined;
}) => {
  let { provider, discoveryError } = d;
  let providerName = provider.provider.name;

  let shortReason: string;
  let detailLines: string[] = [];

  if (!discoveryError) {
    shortReason = 'its capabilities could not be discovered';
    detailLines.push(
      'Metorial could not discover the capabilities of this provider, and the provider backend did not report any additional error detail.'
    );
  } else if (discoveryError.type === 'timeout_error') {
    shortReason = 'the connection timed out';
    detailLines.push(
      `The connection timed out${discoveryError.message ? `: ${discoveryError.message}` : '.'}`
    );
    detailLines.push(
      'A timeout usually means the MCP server did not respond in time, is unreachable, or is taking too long to start up.'
    );
  } else if (discoveryError.type === 'connection_error') {
    shortReason = `the connection could not be established (${discoveryError.error.code})`;
    detailLines.push(
      `Metorial could not establish a connection to the provider (code: ${
        discoveryError.error.code
      }${discoveryError.error.message ? `, ${discoveryError.error.message}` : ''}).`
    );
    detailLines.push(
      'This usually means the MCP server is unreachable, the connection URL or command is misconfigured, or the provided credentials are invalid.'
    );
  } else {
    shortReason = `the provider returned an error (${discoveryError.error.code})`;
    detailLines.push(
      `The provider returned an MCP error during discovery (code: ${
        discoveryError.error.code
      }): ${discoveryError.error.message}.`
    );
  }

  let shortMessage = `Could not connect to the MCP server "${providerName}" because ${shortReason}.`;

  let longMessage = [
    `Metorial attempted to discover and connect to the MCP server "${providerName}", but the connection could not be established, so its tools are currently unavailable.`,
    ...detailLines,
    "Other providers and tools in this session are unaffected and can still be used. To recover, the provider's deployment, connection URL/command, and authentication configuration should be checked, then the connection retried later."
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    shortMessage,
    longMessage,
    data: {
      provider_id: provider.id,
      provider_name: providerName,
      discovery_error: discoveryError ?? null
    }
  };
};

export let buildConnectionFailedTool = (
  provider: ConnectionFailedProvider,
  detail: ReturnType<typeof buildConnectionFailedDetail>
) =>
  buildSyntheticTool({
    sessionProvider: provider,
    idSuffix: CONNECTION_FAILED_TOOL_KEY,
    key: applySessionProviderNameTemplate(provider.nameTemplate!, CONNECTION_FAILED_TOOL_KEY),
    name: `${provider.provider.name} connection failed`,
    description: detail.longMessage,
    metadata: { metorialConnectionFailed: true }
  });
