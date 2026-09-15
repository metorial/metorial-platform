import type { ConduitConnectionDiagnostics } from '@metorial-subspace/connection-utils';
import {
  db,
  type ProviderAuthConfig,
  type ProviderAuthCredentials,
  type ProviderAuthMethod,
  type ProviderConfig,
  type ProviderDeployment,
  type ProviderTool,
  type Session,
  type SessionConnection,
  type SessionProvider
} from '@metorial-subspace/db';
import {
  checkToolAccess,
  checkToolAuthMethodSatisfied,
  checkToolScopesSatisfied,
  resolveGrantedScopes
} from '@metorial-subspace/module-provider-internal';
import { applySessionProviderNameTemplate } from '@metorial-subspace/module-session';
import { buildConnectionFailedDetail } from './connectionFailedTool';
import { CONNECTION_STATUS_OUTPUT_SCHEMA } from './connectionStatusSchema';
import { buildSyntheticTool, type SyntheticProviderTool } from './syntheticTool';

export let CONNECTION_STATUS_TOOL_KEY = 'metorial_connection_status';

let CONNECTION_STATUS_TOOL_DESCRIPTION = [
  'Metorial diagnostic tool. Returns the current status of this Metorial connection: every linked MCP provider, whether its tools could be loaded, which of its tools are available or blocked, the authentication profile in use, and recent errors.',
  `Call this tool when a tool call fails, when expected tools are missing, when a provider seems unreachable, or when you need to explain to the user what is wrong with the connection. It never contacts a provider, doesn't have side effects, and is always safe to call.`
].join('\n\n');

export type ConnectionStatusProvider = SessionProvider & {
  provider: { name: string; description?: string | null };
  deployment?: (ProviderDeployment & { currentVersionOid: bigint | null }) | null;
  config?: (ProviderConfig & { currentVersionOid: bigint | null }) | null;
  authConfig?:
    | (ProviderAuthConfig & {
        currentVersionOid?: bigint | null;
        authCredentials?: ProviderAuthCredentials | null;
        authMethod?: ProviderAuthMethod | null;
      })
    | null;
};

type ProviderHealth = 'ok' | 'degraded' | 'unavailable';

let RECENT_ERROR_LIMIT = 10;

let describeAuthProfile = (provider: ConnectionStatusProvider) => {
  let authConfig = provider.authConfig;
  if (!authConfig) {
    return {
      configured: false,
      auth_method: null,
      auth_config: null,
      credentials: null
    };
  }

  return {
    configured: true,
    auth_method: authConfig.authMethod
      ? {
          key: authConfig.authMethod.key,
          type: authConfig.authMethod.type,
          name: authConfig.authMethod.name
        }
      : null,
    auth_config: {
      id: authConfig.id,
      name: authConfig.name,
      type: authConfig.type,
      status: authConfig.status,
      granted_scopes: authConfig.scopes
    },
    credentials: authConfig.authCredentials
      ? {
          id: authConfig.authCredentials.id,
          type: authConfig.authCredentials.type,
          status: authConfig.authCredentials.status,
          granted_scopes: authConfig.authCredentials.scopes
        }
      : null
  };
};

type ProviderFailure = { code: string; message: string };

let discoveryErrorCode = (
  error: PrismaJson.ProviderDeploymentConfigPairDiscoveryError
): string => {
  if (!error) return 'discovery_failed';
  if (error.type === 'timeout_error') return 'discovery_timeout';
  if (error.type === 'connection_error') return error.error.code;
  return 'provider_error';
};

let resolveUnavailableReason = async (
  provider: ConnectionStatusProvider
): Promise<ProviderFailure> => {
  let pair =
    provider.deployment?.currentVersionOid && provider.config?.currentVersionOid
      ? await db.providerDeploymentConfigPair.findFirst({
          where: {
            providerDeploymentVersionOid: provider.deployment.currentVersionOid,
            providerConfigVersionOid: provider.config.currentVersionOid,
            providerAuthConfigVersionOid: provider.authConfig?.currentVersionOid ?? null
          },
          include: { lastUsedPairVersion: { include: { latestDiscoveryRecord: true } } }
        })
      : null;

  let pairVersion = pair?.lastUsedPairVersion;

  if (pairVersion?.specificationDiscoveryStatus === 'discovering') {
    return {
      code: 'discovery_pending',
      message: `Metorial is still discovering the capabilities of the MCP server "${provider.provider.name}". Its tools should become available shortly.`
    };
  }

  if (pairVersion && !pairVersion.specificationOid) {
    let discoveryError = pairVersion.latestDiscoveryRecord?.error ?? null;

    return {
      code: discoveryErrorCode(discoveryError),
      message: buildConnectionFailedDetail({ provider, discoveryError }).shortMessage
    };
  }

  return {
    code: 'specification_unavailable',
    message: `Metorial has not discovered any capabilities for the MCP server "${provider.provider.name}", so it currently serves no tools.`
  };
};

export type ConnectionDiagnosticsFetcher = (
  provider: ConnectionStatusProvider
) => Promise<ConduitConnectionDiagnostics | null>;

let describeProviderConnection = (diagnostics: ConduitConnectionDiagnostics | null) => {
  if (!diagnostics) return null;

  return {
    state: diagnostics.state,
    transport: diagnostics.transport,
    protocol_version: diagnostics.protocolVersion,
    server_info: diagnostics.serverInfo
      ? {
          name: diagnostics.serverInfo.name,
          title: diagnostics.serverInfo.title ?? null,
          version: diagnostics.serverInfo.version ?? null
        }
      : null,
    last_error: diagnostics.lastError
      ? { code: diagnostics.lastError.code, message: diagnostics.lastError.message }
      : null
  };
};

// Mirrors tools/list; prompts and resources are served through their own endpoints.
let LISTABLE_TOOL_TYPES = new Set(['tool.callable', 'mcp.tool']);

let describeTools = (d: { provider: ConnectionStatusProvider; tools: ProviderTool[] }) => {
  let grantedScopes = resolveGrantedScopes({
    authConfig: d.provider.authConfig,
    authCredentials: d.provider.authConfig?.authCredentials
  });

  return d.tools
    .filter(tool => LISTABLE_TOOL_TYPES.has(tool.value.mcpToolType.type))
    .map(tool => {
      let named = {
        ...tool,
        key: d.provider.nameTemplate
          ? applySessionProviderNameTemplate(d.provider.nameTemplate, tool.key)
          : tool.key
      };

      let isAvailable =
        checkToolAuthMethodSatisfied(tool, d.provider.authConfig?.authMethod).allowed &&
        (grantedScopes === null || checkToolScopesSatisfied(tool, grantedScopes).allowed) &&
        checkToolAccess(named, d.provider, 'list').allowed;

      return {
        name: named.key,
        availability: isAvailable ? ('available' as const) : ('blocked' as const)
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
};

let getProviderStatus = async (d: {
  provider: ConnectionStatusProvider;
  connection: SessionConnection | null | undefined;
  getDiagnostics: ConnectionDiagnosticsFetcher | undefined;
}) => {
  let { provider, connection } = d;

  let instance = await db.sessionProviderInstance.findFirst({
    where: { sessionProviderOid: provider.oid },
    orderBy: { createdAt: 'desc' },
    include: { pairVersion: true }
  });

  let connectionSpecification = connection
    ? await db.sessionConnectionProviderSpecification.findUnique({
        where: {
          connectionOid_sessionProviderOid: {
            connectionOid: connection.oid,
            sessionProviderOid: provider.oid
          }
        }
      })
    : null;

  let versionSpecificationOid = instance
    ? (instance.pairVersion.specificationOid ??
      (
        await db.providerVersion.findFirst({
          where: { oid: instance.pairVersion.versionOid },
          select: { specificationOid: true }
        })
      )?.specificationOid ??
      null)
    : null;

  let specificationOid = connectionSpecification?.specificationOid ?? versionSpecificationOid;

  let tools = describeTools({
    provider,
    tools: specificationOid
      ? await db.providerTool.findMany({ where: { specificationOid, adapterOid: null } })
      : []
  });

  let availableTools = tools.filter(tool => tool.availability === 'available');

  let diagnostics = d.getDiagnostics
    ? await d.getDiagnostics(provider).catch(() => null)
    : null;

  let error: ProviderFailure | null = connectionSpecification?.error ?? null;
  if (!error && diagnostics?.lastError) error = { ...diagnostics.lastError };
  if (!specificationOid && !error) error = await resolveUnavailableReason(provider);

  let health: ProviderHealth = !specificationOid
    ? 'unavailable'
    : error || diagnostics?.state === 'failed'
      ? 'degraded'
      : 'ok';

  let authErrors = provider.authConfig
    ? await db.providerAuthConfigError.findMany({
        where: { authConfigOid: provider.authConfig.oid },
        orderBy: { createdAt: 'desc' },
        take: 3
      })
    : [];

  return {
    id: provider.id,
    name: provider.provider.name,
    tag: provider.tag,

    health,
    tool_count: availableTools.length,
    blocked_tool_count: tools.length - availableTools.length,
    tools,

    tools_are_connection_scoped: !!connectionSpecification,
    tools_last_discovered_at: connectionSpecification?.discoveredAt ?? null,

    error: error ? { code: error.code, message: error.message } : null,

    provider_connection: describeProviderConnection(diagnostics),

    auth: describeAuthProfile(provider),

    recent_auth_errors: authErrors.map(e => ({
      code: e.code,
      message: e.message,
      created_at: e.createdAt
    }))
  };
};

let buildSummary = (d: {
  providers: Awaited<ReturnType<typeof getProviderStatus>>[];
  errorCount: number;
}) => {
  let unavailable = d.providers.filter(p => p.health === 'unavailable');
  let degraded = d.providers.filter(p => p.health === 'degraded');
  let toolCount = d.providers.reduce((total, p) => total + p.tool_count, 0);
  let blockedToolCount = d.providers.reduce((total, p) => total + p.blocked_tool_count, 0);

  let lines = [
    `${d.providers.length} provider(s) linked to this connection, serving ${toolCount} tool(s).`
  ];

  if (blockedToolCount > 0) {
    lines.push(
      `${blockedToolCount} tool(s) are blocked by tool filters, the authentication method in use, or missing scopes, and are listed as blocked below.`
    );
  }

  if (unavailable.length === 0 && degraded.length === 0) {
    lines.push('All providers are healthy.');
  }

  for (let provider of [...unavailable, ...degraded]) {
    lines.push(
      `${provider.name} (${provider.tag}) is ${provider.health}${
        provider.error ? `: ${provider.error.message} (${provider.error.code})` : '.'
      }`
    );
  }

  if (d.errorCount > 0) {
    lines.push(`${d.errorCount} error(s) were recorded on this connection.`);
  }

  if (unavailable.length > 0 || degraded.length > 0) {
    lines.push(
      'Check that the MCP server is reachable, that its URL or command is correct, and that the authentication profile above is still valid. Retrying later may resolve transient failures.'
    );
  }

  return lines.join('\n');
};

export let buildConnectionStatusReport = async (d: {
  session: Session;
  connection: SessionConnection | null | undefined;
  providers: ConnectionStatusProvider[];
  getDiagnostics?: ConnectionDiagnosticsFetcher;
}) => {
  let providers = await Promise.all(
    d.providers.map(provider =>
      getProviderStatus({
        provider,
        connection: d.connection,
        getDiagnostics: d.getDiagnostics
      })
    )
  );

  let errors = d.connection
    ? await db.sessionError.findMany({
        where: { connectionOid: d.connection.oid },
        orderBy: { createdAt: 'desc' },
        take: RECENT_ERROR_LIMIT
      })
    : [];

  let data = {
    session: {
      id: d.session.id,
      created_at: d.session.createdAt
    },
    connection: d.connection
      ? {
          id: d.connection.id,
          transport: d.connection.transport,
          mcp_transport: d.connection.mcpTransport,
          mcp_protocol_version: d.connection.mcpProtocolVersion,
          state: d.connection.state,
          created_at: d.connection.createdAt,
          last_active_at: d.connection.lastActiveAt
        }
      : null,
    providers,
    recent_errors: errors.map(e => ({
      type: e.type,
      code: e.code,
      message: e.message,
      created_at: e.createdAt
    }))
  };

  return {
    summary: buildSummary({ providers, errorCount: errors.length }),
    data
  };
};

let sessionAsToolOwner = (session: Session) =>
  ({ id: session.id, nameTemplate: null }) as unknown as SessionProvider;

export let buildConnectionStatusTool = (session: Session): SyntheticProviderTool =>
  buildSyntheticTool({
    sessionProvider: sessionAsToolOwner(session),
    idSuffix: CONNECTION_STATUS_TOOL_KEY,
    key: CONNECTION_STATUS_TOOL_KEY,
    name: 'Metorial connection status',
    description: CONNECTION_STATUS_TOOL_DESCRIPTION,
    outputJsonSchema: CONNECTION_STATUS_OUTPUT_SCHEMA,
    metadata: { metorialConnectionStatus: true }
  });

export let isConnectionStatusTool = (toolId: string) => toolId === CONNECTION_STATUS_TOOL_KEY;
