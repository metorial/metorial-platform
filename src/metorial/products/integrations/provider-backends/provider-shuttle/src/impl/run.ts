import { generatePlainId } from '@lowerdeck/id';
import { ProgrammablePromise } from '@lowerdeck/programmable-promise';
import { withTimeout } from '@metorial-subspace/connection-utils';
import {
  db,
  messageTranslator,
  snowflake,
  type ShuttleConnection
} from '@metorial-subspace/db';
import {
  IProviderRun,
  IProviderRunConnection,
  normalizeProviderError,
  providerErrorToOutput,
  type ConnectionDiagnostics,
  type ConnectionDiagnosticsState,
  type ConnectionToolListRes,
  type HandleMcpNotificationOrRequestParam,
  type HandleMcpNotificationOrRequestRes,
  type NormalizedProviderError,
  type ProviderRunCreateParam,
  type ProviderRunCreateRes,
  type ProviderRunLogsParam,
  type ProviderRunLogsRes,
  type ProviderRuntimeBehavior,
  type ToolInvocationCreateParam,
  type ToolInvocationCreateRes
} from '@metorial-subspace/provider-utils';
import type { InitializeResult, JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import PQueue from 'p-queue';
import { getTenantForShuttle, shuttle, shuttleLiveClient } from '../client';
import {
  buildMcpAuthMethods,
  buildMcpSpecification,
  buildMcpTools,
  type McpDiscovery,
  type McpSpecificationSource
} from '../lib/mapMcpSpecification';

type ShuttleServerConnectionLog = NonNullable<
  Awaited<ReturnType<typeof shuttle.serverConnection.getLogs>>
>[number];

let CONNECT_TIMEOUT_MS = 30_000;
let REQUEST_TIMEOUT_MS = 120_000;
let LIST_PAGE_LIMIT = 50;

let runtimeBehavior: ProviderRuntimeBehavior = {
  connectTimeoutMs: CONNECT_TIMEOUT_MS,
  requestTimeoutMs: REQUEST_TIMEOUT_MS,
  messageTtlExtensionMs: 1000 * 60 * 2
};

export class ProviderRun extends IProviderRun {
  override async createProviderRun(
    data: ProviderRunCreateParam
  ): Promise<ProviderRunCreateRes & { connection: IProviderRunConnection }> {
    if (
      !data.providerVariant.shuttleServerOid ||
      !data.providerConfigVersion.shuttleConfigOid ||
      !data.providerVersion.shuttleServerVersionOid ||
      (data.providerAuthConfigVersion && !data.providerAuthConfigVersion.shuttleAuthConfigOid)
    ) {
      throw new Error('Provider data is missing required shuttle associations');
    }

    let tenant = await getTenantForShuttle(data.tenant);

    let shuttleServer = await db.shuttleServer.findUniqueOrThrow({
      where: { oid: data.providerVariant.shuttleServerOid }
    });
    let shuttleConfig = await db.shuttleServerConfig.findUniqueOrThrow({
      where: { oid: data.providerConfigVersion.shuttleConfigOid }
    });
    let shuttleVersion = await db.shuttleServerVersion.findUniqueOrThrow({
      where: { oid: data.providerVersion.shuttleServerVersionOid }
    });
    let shuttleAuthConfig = data.providerAuthConfigVersion?.shuttleAuthConfigOid
      ? await db.shuttleAuthConfig.findUniqueOrThrow({
          where: { oid: data.providerAuthConfigVersion.shuttleAuthConfigOid }
        })
      : null;
    let providerDeployment = await db.providerDeployment.findUniqueOrThrow({
      where: { oid: data.providerDeployment.oid },
      include: { serverInstanceConfiguration: true }
    });

    let res = await shuttle.serverConnection.create({
      tenantId: tenant.id,
      serverVersionId: shuttleVersion.id,
      serverConfigId: shuttleConfig.id,
      serverAuthConfigId: shuttleAuthConfig?.id,
      serverInstanceConfigurationId: providerDeployment.serverInstanceConfiguration?.id,

      client: data.mcp?.clientInfo ?? {
        name: data.participant.name,
        version: '1.0.0'
      },
      capabilities: data.mcp?.capabilities ?? {}
    });

    let shuttleConnection = await db.shuttleConnection.create({
      data: {
        oid: snowflake.nextId(),
        id: res.id,
        shuttleServerOid: shuttleServer.oid,
        shuttleServerVersionOid: shuttleVersion.oid,
        providerRunOid: data.providerRun.oid
      }
    });

    return {
      shuttleConnection,
      connection: new ProviderRunConnection(data, shuttleConnection)
    };
  }

  override async getProviderRunLogs(data: ProviderRunLogsParam): Promise<ProviderRunLogsRes> {
    let tenant = await getTenantForShuttle(data.tenant);

    let connections = await db.shuttleConnection.findMany({
      where: { providerRunOid: data.providerRun.oid },
      take: 10
    });

    let queue = new PQueue({ concurrency: 5 });

    let logs = await queue.addAll(
      connections.map(conn => async () => {
        let res = await shuttle.serverConnection.getLogs({
          tenantId: tenant.id,
          serverConnectionId: conn.id
        });

        return (res ?? []).map((log: ShuttleServerConnectionLog) => ({
          outputType: log.outputType,
          timestamp: log.timestamp,
          message: log.message
        }));
      })
    );

    let sorted = logs.flat().sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      logs: sorted
    };
  }

  override getRuntimeBehavior(): ProviderRuntimeBehavior {
    return runtimeBehavior;
  }
}

class ProviderRunConnection extends IProviderRunConnection {
  #ready = new ProgrammablePromise<void>();
  #initialized = new ProgrammablePromise<InitializeResult>();
  #initializeResult: InitializeResult | null = null;

  #conRef: {
    close: () => Promise<void>;
    sendMcpMessage: (msg: JSONRPCMessage) => Promise<void>;
  } | null = null;

  #connectionError: NormalizedProviderError | null = null;
  #state: ConnectionDiagnosticsState = 'connecting';

  #pendingRequests = new Map<
    string | number,
    {
      resolve: (msg: JSONRPCMessage) => void;
      reject: (error: ProviderRunConnectionError) => void;
    }
  >();

  #specificationSource: Promise<McpSpecificationSource> | null = null;

  constructor(
    private data: ProviderRunCreateParam,
    private shuttleConnection: ShuttleConnection
  ) {
    super();

    // The promise is intentionally not awaited: readiness and every failure
    // path are surfaced through #ready / #connectionError instead.
    void this.#init();

    this.#initialized.promise.catch(() => {});
  }

  override async handleMcpResponseOrNotification(
    data: HandleMcpNotificationOrRequestParam
  ): Promise<HandleMcpNotificationOrRequestRes> {
    let error = await this.#awaitReady();
    if (error) return { output: providerErrorToOutput(error) };

    try {
      await this.#conRef!.sendMcpMessage(data.input);
      return {};
    } catch (sendError) {
      return { output: providerErrorToOutput(this.#toNormalized(sendError)) };
    }
  }

  override async handleToolInvocation(
    data: ToolInvocationCreateParam
  ): Promise<ToolInvocationCreateRes> {
    try {
      let mcpMessage = await messageTranslator.toMcp({
        data: data.input,
        message: data.message,
        tool: data.tool,
        sessionProvider: data.sessionProvider,
        recipient: 'provider_backend'
      });
      if (!mcpMessage) {
        return {
          output: {
            type: 'error',
            error: {
              code: 'invalid_request',
              message: 'Unable to process the provided input message'
            }
          }
        };
      }

      let error = await this.#awaitReady();
      if (error) return { output: providerErrorToOutput(error) };

      let id = 'id' in mcpMessage && mcpMessage.id ? mcpMessage.id : undefined;

      if (id === undefined) {
        await this.#conRef!.sendMcpMessage(mcpMessage);
        return {};
      }

      let outputMessage = await this.#request(
        mcpMessage,
        id,
        runtimeBehavior.requestTimeoutMs
      );

      return {
        output: {
          type: 'success',
          data: {
            type: 'mcp',
            data: outputMessage
          }
        }
      };
    } catch (error) {
      return { output: providerErrorToOutput(this.#toNormalized(error)) };
    }
  }

  override async listConnectionTools(): Promise<ConnectionToolListRes> {
    let readyError = await this.#awaitReady();
    if (readyError) return { status: 'failure', error: readyError };

    try {
      let initializeResult = await this.#awaitInitialized();
      let source = await this.#getSpecificationSource();

      let tools = await this.#listPaged<any>('tools/list', 'tools');
      let prompts = initializeResult.capabilities.prompts
        ? await this.#listPaged<any>('prompts/list', 'prompts')
        : [];
      let resourceTemplates = initializeResult.capabilities.resources
        ? await this.#listPaged<any>('resources/templates/list', 'resourceTemplates')
        : [];

      let discovery: McpDiscovery = {
        specId: `shuttle::${source.serverId}::${source.serverVersionId}::connection`,
        info: initializeResult.serverInfo,
        capabilities: initializeResult.capabilities,
        instructions: initializeResult.instructions,
        tools,
        prompts,
        resourceTemplates
      };

      return {
        status: 'success',
        type: 'full',
        specification: buildMcpSpecification(source, discovery),
        features: {
          supportsAuthMethod: source.hasOAuth,
          configContainsAuth: !source.hasOAuth
        },
        tools: buildMcpTools(source, discovery),
        authMethods: buildMcpAuthMethods(source),
        triggers: []
      };
    } catch (error) {
      return { status: 'failure', error: this.#toNormalized(error) };
    }
  }

  override async getConnectionDiagnostics(): Promise<ConnectionDiagnostics> {
    return {
      state: this.#state,
      transport: `metorial/mcp-connector`,
      protocolVersion: this.#initializeResult?.protocolVersion ?? null,
      serverInfo: this.#initializeResult
        ? {
            name: this.#initializeResult.serverInfo.name,
            version: this.#initializeResult.serverInfo.version,
            title: this.#initializeResult.serverInfo.title
          }
        : null,
      lastError: this.#connectionError
    };
  }

  override async close(): Promise<void> {
    if (this.#state !== 'failed') this.#state = 'closed';

    let error = this.#connectionError ?? normalizeProviderError(null, 'provider_closed');
    this.#ready.resolve();
    this.#rejectPending(error);
    this.#failInitialization(error);

    await this.emitClose();

    if (this.#conRef) {
      try {
        await this.#conRef.close();
      } catch {}
    }
  }

  async #init() {
    try {
      let shuttleTenant = await getTenantForShuttle(this.data.tenant);

      this.#conRef = await shuttleLiveClient.connect({
        tenantId: shuttleTenant.id,
        connectionId: this.shuttleConnection.id,
        onOpen: async () => {
          if (this.#state === 'connecting') this.#state = 'connected';
          this.#ready.resolve();
        },
        onClose: async () => {
          await this.#handleTransportClosed();
        },
        onMessage: async (
          data:
            | { type: 'mcp.message'; data: JSONRPCMessage }
            | { type: 'close'; data?: undefined }
            | { type: 'initialized'; data: InitializeResult }
            | { type: 'error'; data: { code: string; message: string } }
        ) => {
          if (data.type === 'mcp.message') {
            let id = 'id' in data.data && data.data.id ? data.data.id : undefined;
            if (id !== undefined) {
              let pending = this.#pendingRequests.get(id);
              if (pending) {
                this.#pendingRequests.delete(id);
                pending.resolve(data.data);
                return;
              }
            }

            await this.emitMcpMessage(data.data);
          } else if (data.type === 'initialized') {
            this.#initializeResult = data.data;
            this.#state = 'connected';
            this.#ready.resolve();
            this.#initialized.resolve(data.data);
          } else if (data.type === 'close') {
            await this.#handleTransportClosed();
          } else if (data.type === 'error') {
            this.#failConnection(normalizeProviderError(data.data));
            await this.close();
          }
        }
      });
    } catch (error) {
      this.#failConnection(normalizeProviderError(error, 'provider_unreachable'));
    }
  }

  async #handleTransportClosed() {
    if (this.#state !== 'failed') this.#state = 'closed';

    let error = this.#connectionError ?? normalizeProviderError(null, 'provider_closed');
    this.#ready.resolve();
    this.#rejectPending(error);
    this.#failInitialization(error);

    await this.emitClose();
  }

  #failConnection(error: NormalizedProviderError) {
    this.#connectionError ??= error;
    this.#state = 'failed';
    this.#ready.resolve();
    this.#rejectPending(this.#connectionError);
    this.#failInitialization(this.#connectionError);
  }

  #rejectPending(error: NormalizedProviderError) {
    for (let pending of this.#pendingRequests.values()) {
      pending.reject(new ProviderRunConnectionError(error));
    }
    this.#pendingRequests.clear();
  }

  #failInitialization(error: NormalizedProviderError) {
    if (this.#initializeResult) return;
    this.#initialized.reject(new ProviderRunConnectionError(error));
  }

  async #awaitReady(): Promise<NormalizedProviderError | null> {
    if (this.#connectionError) return this.#connectionError;

    try {
      await withTimeout(
        this.#ready.promise,
        runtimeBehavior.connectTimeoutMs,
        'Shuttle connection'
      );
    } catch {
      this.#connectionError ??= normalizeProviderError(null, 'provider_connect_timeout');
      this.#state = 'failed';
      return this.#connectionError;
    }

    if (this.#connectionError) return this.#connectionError;
    if (!this.#conRef) return normalizeProviderError(null, 'provider_unreachable');

    return null;
  }

  async #awaitInitialized(): Promise<InitializeResult> {
    if (this.#initializeResult) return this.#initializeResult;

    try {
      return await withTimeout(
        this.#initialized.promise,
        runtimeBehavior.connectTimeoutMs,
        'MCP initialization'
      );
    } catch (error) {
      if (error instanceof ProviderRunConnectionError) throw error;
      throw new ProviderRunConnectionError(
        normalizeProviderError(null, 'provider_connect_timeout')
      );
    }
  }

  async #request(
    message: JSONRPCMessage,
    id: string | number,
    timeoutMs: number
  ): Promise<JSONRPCMessage> {
    let response = new ProgrammablePromise<JSONRPCMessage>();

    this.#pendingRequests.set(id, {
      resolve: msg => response.resolve(msg),
      reject: error => response.reject(error)
    });

    let timer = setTimeout(() => {
      this.#pendingRequests.delete(id);
      response.reject(
        new ProviderRunConnectionError(
          normalizeProviderError(null, 'provider_request_timeout')
        )
      );
    }, timeoutMs);

    try {
      await this.#conRef!.sendMcpMessage(message);
      return await response.promise;
    } finally {
      clearTimeout(timer);
      this.#pendingRequests.delete(id);
    }
  }

  async #listPaged<T>(method: string, resultKey: string): Promise<T[]> {
    let items: T[] = [];
    let cursor: string | undefined = undefined;

    for (let page = 0; page < LIST_PAGE_LIMIT; page++) {
      let id = generatePlainId(16);

      let response: any = await this.#request(
        {
          jsonrpc: '2.0',
          id,
          method,
          params: cursor ? { cursor } : {}
        } as JSONRPCMessage,
        id,
        runtimeBehavior.requestTimeoutMs
      );

      if (response?.error) {
        throw new ProviderRunConnectionError(
          normalizeProviderError(response.error, 'provider_protocol_error')
        );
      }

      items.push(...((response?.result?.[resultKey] as T[]) ?? []));

      cursor = response?.result?.nextCursor;
      if (!cursor) break;
    }

    return items;
  }

  async #getSpecificationSource(): Promise<McpSpecificationSource> {
    if (!this.#specificationSource) {
      this.#specificationSource = (async () => {
        let tenant = await getTenantForShuttle(this.data.tenant);

        let shuttleServerVersion = await db.shuttleServerVersion.findUniqueOrThrow({
          where: { oid: this.data.providerVersion.shuttleServerVersionOid! },
          include: { server: true }
        });

        let [server, version] = await Promise.all([
          shuttle.server.get({
            serverId: shuttleServerVersion.server.id,
            tenantId: tenant.id
          }),
          shuttle.serverVersion.get({
            serverVersionId: shuttleServerVersion.id,
            tenantId: tenant.id
          })
        ]);

        return {
          serverId: server.id,
          serverName: server.name,
          serverVersionId: version.id,
          configJsonSchema: version.configSchema,
          oauthAuthConfigSchema: server.oauthConfig?.authConfigSchema,
          hasOAuth: !!server.oauthConfig
        };
      })();
    }

    return await this.#specificationSource;
  }

  #toNormalized(error: unknown): NormalizedProviderError {
    if (error instanceof ProviderRunConnectionError) return error.normalized;
    return normalizeProviderError(error);
  }
}

class ProviderRunConnectionError extends Error {
  constructor(readonly normalized: NormalizedProviderError) {
    super(normalized.message);
    this.name = 'ProviderRunConnectionError';
  }
}
