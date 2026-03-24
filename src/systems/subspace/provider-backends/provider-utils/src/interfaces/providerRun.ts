import type {
  Provider,
  ProviderAuthConfigVersion,
  ProviderConfigVersion,
  ProviderDeployment,
  ProviderRun,
  ProviderTool,
  ProviderVariant,
  ProviderVersion,
  Session,
  SessionConnection,
  SessionMessage,
  SessionParticipant,
  SessionProvider,
  ShuttleConnection,
  SlateSession,
  SlateToolCall,
  Tenant
} from '@metorial-subspace/db';
import type { InitializeRequest, JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { IProviderFunctionality } from '../providerFunctionality';

export abstract class IProviderRun extends IProviderFunctionality {
  abstract createProviderRun(
    data: ProviderRunCreateParam
  ): Promise<ProviderRunCreateRes & { connection: IProviderRunConnection }>;

  abstract getProviderRunLogs(data: ProviderRunLogsParam): Promise<ProviderRunLogsRes>;
}

export abstract class IProviderRunConnection {
  #closeListeners = new Set<() => Promise<void>>();
  #messageListeners = new Set<(data: JSONRPCMessage) => Promise<void>>();
  #isClosed = false;

  public onClose(listener: () => Promise<void>) {
    if (this.#isClosed) {
      listener();
      return () => {};
    }

    this.#closeListeners.add(listener);
    return () => this.#closeListeners.delete(listener);
  }

  public onMcpNotificationOrRequest(listener: (data: JSONRPCMessage) => Promise<void>) {
    this.#messageListeners.add(listener);
    return () => this.#messageListeners.delete(listener);
  }

  protected async emitClose() {
    if (this.#isClosed) return;
    this.#isClosed = true;

    for (let listener of this.#closeListeners) {
      await listener();
    }
  }

  protected async emitMcpMessage(data: JSONRPCMessage) {
    for (let listener of this.#messageListeners) {
      await listener(data);
    }
  }

  abstract handleToolInvocation(
    data: ToolInvocationCreateParam
  ): Promise<ToolInvocationCreateRes>;

  abstract handleMcpResponseOrNotification(
    data: HandleMcpNotificationOrRequestParam
  ): Promise<HandleMcpNotificationOrRequestRes>;

  abstract close(): Promise<void>;
}

export interface ProviderRunCreateParam {
  tenant: Tenant;
  provider: Provider;
  providerRun: ProviderRun;

  providerVariant: ProviderVariant;
  providerVersion: ProviderVersion;
  providerDeployment: ProviderDeployment;
  providerConfigVersion: ProviderConfigVersion;
  providerAuthConfigVersion: ProviderAuthConfigVersion | null;

  session: Session;
  connection: SessionConnection;
  participant: SessionParticipant;

  mcp: {
    clientInfo: InitializeRequest['params']['clientInfo'];
    capabilities: InitializeRequest['params']['capabilities'];
  } | null;
}

export interface ProviderRunCreateRes {
  slateSession?: SlateSession;
  shuttleConnection?: ShuttleConnection;
}

export interface ToolInvocationCreateParam {
  tool: ProviderTool;
  sender: SessionParticipant;

  input: PrismaJson.SessionMessageInput;
  message: SessionMessage;
  sessionProvider: SessionProvider;
}

export interface ToolInvocationCreateRes {
  slateToolCall?: SlateToolCall;
  output?:
    | {
        type: 'success';
        data: PrismaJson.SessionMessageOutput;
      }
    | {
        type: 'error';
        error: {
          code: string;
          message: string;
        };
      };
}

export interface HandleMcpNotificationOrRequestParam {
  sender: SessionParticipant;
  input: JSONRPCMessage;
  message: SessionMessage;
}

export interface HandleMcpNotificationOrRequestRes {
  slateToolCall?: SlateToolCall;
  output?: {
    type: 'error';
    error: {
      code: string;
      message: string;
    };
  };
}

export interface ProviderRunLogsParam {
  tenant: Tenant;
  providerRun: ProviderRun;
}

export interface ProviderRunLog {
  timestamp: Date;
  message: string;
  outputType: 'stdout' | 'stderr' | 'debug.info' | 'debug.warning' | 'debug.error';
}

export interface ProviderRunLogsRes {
  logs: ProviderRunLog[];
}
