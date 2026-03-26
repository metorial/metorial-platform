import { badRequestError, ServiceError } from '@lowerdeck/error';
import { db, messageInputToToolCall } from '@metorial-subspace/db';
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
import { getNativeIntegration } from '../registry';

let getNativeIdentifierFromProviderIdentifier = (identifier: string) => {
  let prefix = 'provider::native::';
  let suffix = '::provider';

  if (!identifier.startsWith(prefix) || !identifier.endsWith(suffix)) {
    throw new Error(`Invalid native provider identifier: ${identifier}`);
  }

  return identifier.slice(prefix.length, -suffix.length);
};

export class ProviderRun extends IProviderRun {
  override async createProviderRun(
    data: ProviderRunCreateParam
  ): Promise<ProviderRunCreateRes & { connection: IProviderRunConnection }> {
    return {
      connection: new ProviderRunConnection(data)
    };
  }

  override async getProviderRunLogs(_data: ProviderRunLogsParam): Promise<ProviderRunLogsRes> {
    return {
      logs: []
    };
  }
}

class ProviderRunConnection extends IProviderRunConnection {
  constructor(private readonly params: ProviderRunCreateParam) {
    super();
  }

  override async handleMcpResponseOrNotification(
    _data: HandleMcpNotificationOrRequestParam
  ): Promise<HandleMcpNotificationOrRequestRes> {
    return {};
  }

  override async handleToolInvocation(
    data: ToolInvocationCreateParam
  ): Promise<ToolInvocationCreateRes> {
    let integrationIdentifier = getNativeIdentifierFromProviderIdentifier(
      this.params.provider.identifier
    );
    let integration = getNativeIntegration(integrationIdentifier);
    if (!integration) {
      throw new Error(`Native integration not registered: ${integrationIdentifier}`);
    }

    let tool = integration.tools.find(toolEntry => toolEntry.key === data.tool.key);
    if (!tool) {
      return {
        output: {
          type: 'error',
          error: {
            code: 'tool_not_found',
            message: `Native tool not registered: ${data.tool.key}`
          }
        }
      };
    }

    let rawInput = await messageInputToToolCall(data.input, data.message);

    let parsedInput = await tool.input.safeParseAsync(rawInput);
    if (!parsedInput.success) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid native tool input',
          data: parsedInput.error.flatten()
        })
      );
    }

    let sessionProvider = await db.sessionProvider.findUniqueOrThrow({
      where: { oid: data.sessionProvider.oid },
      include: {
        tenant: true,
        environment: true,
        solution: true,
        session: true
      }
    });

    if (!data.message.connectionOid) {
      throw new Error('Native tool invocation requires a session connection');
    }

    let connection = await db.sessionConnection.findUniqueOrThrow({
      where: { oid: data.message.connectionOid }
    });

    let result = await tool.invoke(parsedInput.data, {
      tenant: sessionProvider.tenant,
      environment: sessionProvider.environment,
      solution: sessionProvider.solution,
      session: sessionProvider.session,
      message: data.message,
      connection
    });

    if (tool.output) {
      let parsedOutput = await tool.output.safeParseAsync(result);
      if (!parsedOutput.success) {
        throw new Error(`Native tool returned invalid output: ${tool.key}`);
      }

      return {
        output: {
          type: 'success',
          data: {
            type: 'tool.result',
            data: parsedOutput.data
          }
        }
      };
    }

    return {
      output: {
        type: 'success',
        data: {
          type: 'tool.result',
          data: result as Record<string, any>
        }
      }
    };
  }

  override async close(): Promise<void> {
    await this.emitClose();
  }
}
