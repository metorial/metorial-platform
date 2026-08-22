import {
  db,
  messageInputToToolCall,
  snowflake,
  type SlateSession
} from '@metorial-subspace/db';
import type {
  ConnectionDiagnostics,
  ConnectionToolListRes,
  HandleMcpNotificationOrRequestParam,
  HandleMcpNotificationOrRequestRes,
  ProviderRunCreateParam,
  ProviderRunCreateRes,
  ProviderRunLogsParam,
  ProviderRunLogsRes,
  ProviderRuntimeBehavior,
  PublicToolInvocationParam,
  PublicToolInvocationRes,
  ToolInvocationCreateParam,
  ToolInvocationCreateRes
} from '@metorial-subspace/provider-utils';
import { IProviderRun, IProviderRunConnection } from '@metorial-subspace/provider-utils';
import PQueue from 'p-queue';
import { getTenantForSlates, slates } from '../client';

export class ProviderRun extends IProviderRun {
  override async createProviderRun(
    data: ProviderRunCreateParam
  ): Promise<ProviderRunCreateRes & { connection: IProviderRunConnection }> {
    if (
      !data.providerVariant.slateOid ||
      !data.providerConfigVersion.slateInstanceOid ||
      !data.providerVersion.slateVersionOid
    ) {
      throw new Error('Provider data is missing required slate associations');
    }

    let tenant = await getTenantForSlates(data.tenant);

    let slate = await db.slate.findUniqueOrThrow({
      where: { oid: data.providerVariant.slateOid }
    });
    let slateInstance = await db.slateInstance.findUniqueOrThrow({
      where: { oid: data.providerConfigVersion.slateInstanceOid }
    });
    let slateVersion = await db.slateVersion.findUniqueOrThrow({
      where: { oid: data.providerVersion.slateVersionOid }
    });
    let providerDeployment = await db.providerDeployment.findUniqueOrThrow({
      where: { oid: data.providerDeployment.oid },
      include: { slateInstanceConfiguration: true }
    });

    let res = await slates.slateSession.create({
      tenantId: tenant.id,
      slateId: slate.id,
      slateInstanceId: slateInstance.id,
      lockedSlateVersion: slateVersion.id,
      slateInstanceConfigurationId: providerDeployment.slateInstanceConfiguration?.id
    });

    let slateSession = await db.slateSession.create({
      data: {
        oid: snowflake.nextId(),
        id: res.id,
        providerRunOid: data.providerRun.oid
      }
    });

    return {
      slateSession,

      connection: new ProviderRunConnection(data, slateSession)
    };
  }

  override async getProviderRunLogs(data: ProviderRunLogsParam): Promise<ProviderRunLogsRes> {
    let tenant = await getTenantForSlates(data.tenant);

    let toolCalls = await db.slateToolCall.findMany({
      where: {
        session: { providerRunOid: data.providerRun.oid },
        sessionMessages: data.sessionMessageIds
          ? { some: { id: { in: data.sessionMessageIds } } }
          : undefined
      },
      take: 100,
      orderBy: { createdAt: 'desc' } // Get the latest 100 tool calls
    });

    let queue = new PQueue({ concurrency: 5 });

    let logs = await queue.addAll(
      toolCalls.map(call => async () => {
        let res = await slates.slateSessionToolCall.getLogs({
          tenantId: tenant.id,
          slateSessionToolCallId: call.id
        });

        return res.invocation.logs.map(log => ({
          outputType: 'stdout' as const,
          timestamp: new Date(log.timestamp),
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
    return {
      connectTimeoutMs: 30_000,
      requestTimeoutMs: 120_000,
      messageTtlExtensionMs: 1000 * 30
    };
  }

  override async callPublicTool(data: PublicToolInvocationParam): Promise<PublicToolInvocationRes> {
    if (!data.providerVersion.slateVersionOid) {
      throw new Error('Provider version does not have a slate associated with it');
    }

    let tenant = await getTenantForSlates(data.tenant);

    let slateVersion = await db.slateVersion.findUniqueOrThrow({
      where: { oid: data.providerVersion.slateVersionOid },
      include: { slate: true }
    });

    let res = await slates.slatePublicToolCall.call({
      tenantId: tenant.id,
      slateId: slateVersion.slate.id,
      slateVersionId: slateVersion.id,
      toolId: data.toolKey,
      input: data.input,
      participants: [
        {
          type: 'consumer',
          id: data.caller?.id ?? 'subspace',
          name: data.caller?.name ?? 'Subspace',
          description: data.caller?.description
        }
      ]
    });

    if (res.status === 'error') {
      return { status: 'error', error: res.error };
    }

    return {
      status: 'success',
      output: res.output,
      message: res.message,
      attachments: res.attachments
    };
  }
}

export class ProviderRunConnection extends IProviderRunConnection {
  constructor(
    private readonly params: ProviderRunCreateParam,
    private readonly slateSession: SlateSession
  ) {
    super();
  }

  private get providerAuthConfigVersion() {
    return this.params.providerAuthConfigVersion;
  }

  private get tenant() {
    return this.params.tenant;
  }

  override async handleMcpResponseOrNotification(
    data: HandleMcpNotificationOrRequestParam
  ): Promise<HandleMcpNotificationOrRequestRes> {
    return {};
  }

  override async handleToolInvocation(
    data: ToolInvocationCreateParam
  ): Promise<ToolInvocationCreateRes> {
    if (this.params.session.isInternal) {
      if (
        !data.tool.adapterOid ||
        !this.params.session.adapterGlobalOid ||
        !this.params.adapter
      ) {
        throw new Error('Internal sessions may only invoke tools from their adapter');
      }
      let adapter = await db.providerAdapter.findFirst({
        where: {
          oid: data.tool.adapterOid,
          globalOid: this.params.session.adapterGlobalOid,
          global: { identifier: this.params.adapter.identifier }
        },
        select: { oid: true }
      });
      if (!adapter) {
        throw new Error('Tool adapter does not match the internal session adapter');
      }
    } else if (data.tool.adapterOid || this.params.adapter) {
      throw new Error('Adapter-linked tools require an internal session');
    }

    if (this.providerAuthConfigVersion && !this.providerAuthConfigVersion.slateAuthConfigOid) {
      throw new Error('Provider auth config is missing slate auth config association');
    }

    let tenant = await getTenantForSlates(this.tenant);

    let slateAuthConfig = this.providerAuthConfigVersion?.slateAuthConfigOid
      ? await db.slateAuthConfig.findUniqueOrThrow({
          where: { oid: this.providerAuthConfigVersion.slateAuthConfigOid }
        })
      : null;
    let input = await messageInputToToolCall(data.input, data.message);

    let res = await slates.slateSessionToolCall.call({
      tenantId: tenant.id,
      toolId: data.tool.callableId,
      sessionId: this.slateSession.id,
      authConfigId: slateAuthConfig?.id,

      input,

      participants: [
        {
          type: 'consumer',
          id: data.sender.id,
          name: data.sender.name,
          description: (data.sender.payload as any).description
        }
      ]
    });

    let slateToolCall = await db.slateToolCall.create({
      data: {
        oid: snowflake.nextId(),
        id: res.toolCallId,
        sessionOid: this.slateSession.oid
      }
    });

    if (res.status === 'error') {
      return {
        slateToolCall,
        output: { type: 'error', error: res.error }
      };
    }

    let attachments = Array.isArray(res.attachments) ? res.attachments : [];
    let output = attachments.length
      ? {
          ...res.output,
          $attachments: attachments
        }
      : res.output;

    return {
      slateToolCall,
      output: {
        type: 'success',
        data: {
          type: 'tool.result',
          data: output
        }
      }
    };
  }

  override async listConnectionTools(): Promise<ConnectionToolListRes> {
    return { status: 'not_supported' };
  }

  override async getConnectionDiagnostics(): Promise<ConnectionDiagnostics> {
    return {
      state: 'connected',
      transport: 'metorial/first_party',
      protocolVersion: null,
      serverInfo: { name: this.params.provider.slug },
      lastError: null
    };
  }

  override async close(): Promise<void> {
    await this.emitClose();
  }
}
