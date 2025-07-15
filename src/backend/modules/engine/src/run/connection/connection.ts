import { JSONRPCMessage } from '@metorial/mcp-utils';
import { EngineMcpMessage } from '../mcp/message';
import { MCPMessageType } from '../mcp/types';
import { EngineSessionConnectionInternal } from './internal';
import { EngineSessionProxy } from './proxy';
import { EngineRunConfig } from './types';

export abstract class EngineSessionConnection {
  static async create(config: EngineRunConfig) {
    let inner = await EngineSessionConnectionInternal.ensure(config);
    if (!inner) return null;

    return new EngineSessionProxy(inner);
  }

  abstract getMcpStream(i: {
    replayAfterUuid?: string;
    onlyIds?: string[];
    onlyMessageTypes?: MCPMessageType[];
    signal: AbortSignal;
  }): AsyncGenerator<EngineMcpMessage>;

  abstract sendMcpMessageStream(
    raw: JSONRPCMessage[],
    opts: {
      includeResponses?: boolean;
      signal: AbortSignal;
    }
  ): AsyncGenerator<EngineMcpMessage>;

  abstract sendMcpMessage(raw: JSONRPCMessage[]): Promise<void>;

  abstract close(): void;
}
