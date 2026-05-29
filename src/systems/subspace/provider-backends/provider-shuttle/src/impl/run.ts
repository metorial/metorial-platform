import { ProgrammablePromise } from '@lowerdeck/programmable-promise';
import {
  db,
  messageTranslator,
  snowflake,
  type ShuttleConnection
} from '@metorial-subspace/db';
import { enclaveService } from '@metorial-subspace/module-enclave';
import {
  IProviderRun,
  IProviderRunConnection,
  type HandleMcpNotificationOrRequestParam,
  type HandleMcpNotificationOrRequestRes,
  type ProviderRunCreateParam,
  type ProviderRunCreateRes,
  type ProviderRunLogsParam,
  type ProviderRunLogsRes,
  type ToolInvocationCreateParam,
  type ToolInvocationCreateRes
} from '@metorial-subspace/provider-utils';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import PQueue from 'p-queue';
import { getTenantForShuttle, shuttle, shuttleLiveClient } from '../client';

let getEnclaveConnectionContext = async (data: ProviderRunCreateParam) => {
  let providerDeployment = await db.providerDeployment.findUnique({
    where: { oid: data.providerDeployment.oid },
    include: {
      environment: true,
      enclave: true
    }
  });

  if (!providerDeployment?.enclave) return {};

  let compiledNetworkRules = await enclaveService.useEnclave({
    tenant: data.tenant,
    environment: providerDeployment.environment,
    enclave: providerDeployment.enclave
  });

  return {
    enclaveId: providerDeployment.enclave.id,
    egressPolicy: compiledNetworkRules.egress as PrismaJson.CompiledEgressNetworkAllowList
  };
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
      throw new Error('Provider data is missing required slate associations');
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
    let enclaveConnectionContext = await getEnclaveConnectionContext(data);

    let res = await shuttle.serverConnection.create({
      tenantId: tenant.id,
      serverVersionId: shuttleVersion.id,
      serverConfigId: shuttleConfig.id,
      serverAuthConfigId: shuttleAuthConfig?.id,

      client: data.mcp?.clientInfo ?? {
        name: data.participant.name,
        version: '1.0.0'
      },
      capabilities: data.mcp?.capabilities ?? {},
      ...enclaveConnectionContext
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

        return (res ?? []).map(log => ({
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
}

class ProviderRunConnection extends IProviderRunConnection {
  #readyPromise = new ProgrammablePromise<void>();
  #conRef: {
    close: () => Promise<void>;
    sendMcpMessage: (msg: JSONRPCMessage) => Promise<void>;
  } | null = null;
  #connectionError: ProviderRunConnectionError | null = null;

  #mcpMessageListeners = new Map<
    string | number,
    {
      resolve: (msg: JSONRPCMessage) => Promise<void>;
      reject: (error: ProviderRunConnectionError) => void;
    }
  >();

  constructor(
    private data: ProviderRunCreateParam,
    private shuttleConnection: ShuttleConnection
  ) {
    super();

    this.init();
  }

  override async handleMcpResponseOrNotification(
    data: HandleMcpNotificationOrRequestParam
  ): Promise<HandleMcpNotificationOrRequestRes> {
    await this.#conRef?.sendMcpMessage(data.input);
    return {};
  }

  async handleToolInvocation(
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

      await this.#readyPromise;

      if (this.#connectionError) {
        throw this.#connectionError;
      }

      if (!this.#conRef) {
        throw new Error('Connection is not established');
      }

      let id = 'id' in mcpMessage && mcpMessage.id ? mcpMessage.id : undefined;

      if (id !== undefined) {
        let responsePromise = new ProgrammablePromise<JSONRPCMessage>();
        this.#mcpMessageListeners.set(id, {
          resolve: async msg => responsePromise.resolve(msg),
          reject: error => responsePromise.reject(error)
        });

        await this.#conRef.sendMcpMessage(mcpMessage);

        let outputMessage = await responsePromise.promise;

        return {
          output: {
            type: 'success',
            data: {
              type: 'mcp',
              data: outputMessage
            }
          }
        };
      } else {
        await this.#conRef.sendMcpMessage(mcpMessage);
        return {};
      }
    } catch (error) {
      if (error instanceof ProviderRunConnectionError) {
        return {
          output: {
            type: 'error',
            error: {
              code: error.code,
              message: error.message
            }
          }
        };
      }

      throw error;
    }
  }

  private handleConnectionError(error: { code: string; message: string }) {
    let connectionError = new ProviderRunConnectionError(error.code, error.message);
    this.#connectionError = connectionError;
    this.#readyPromise.resolve();

    for (let listener of this.#mcpMessageListeners.values()) {
      listener.reject(connectionError);
    }
    this.#mcpMessageListeners.clear();
  }

  async close(): Promise<void> {
    this.#readyPromise.resolve();
    await this.emitClose();
    if (this.#conRef) {
      await this.#conRef.close();
    }
  }

  async init() {
    let shuttleTenant = await getTenantForShuttle(this.data.tenant);

    let con = await shuttleLiveClient.connect({
      tenantId: shuttleTenant.id,
      connectionId: this.shuttleConnection.id,
      onOpen: async () => {
        this.#readyPromise.resolve();
      },
      onClose: async () => {
        await this.emitClose();
      },
      onMessage: async (
        data:
          | { type: 'mcp.message'; data: JSONRPCMessage }
          | { type: 'close'; data?: undefined }
          | { type: 'initialized'; data: unknown }
          | { type: 'error'; data: { code: string; message: string } }
      ) => {
        if (data.type === 'mcp.message') {
          // Handle response to a specific tool invocation
          let id = 'id' in data.data && data.data.id ? data.data.id : undefined;
          if (id !== undefined) {
            let listener = this.#mcpMessageListeners.get(id);
            if (listener) {
              await listener.resolve(data.data);
              this.#mcpMessageListeners.delete(id);

              return; // No need to emit as mcp request/notification
            }
          }

          await this.emitMcpMessage(data.data);
        } else if (data.type === 'close') {
          await this.emitClose();
        } else if (data.type === 'error') {
          if (data.data.code === 'egress_policy_blocked') {
            this.handleConnectionError(data.data);
          }
          this.close();
        }
      }
    });

    this.#conRef = con;
  }
}

class ProviderRunConnectionError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ProviderRunConnectionError';
  }
}
