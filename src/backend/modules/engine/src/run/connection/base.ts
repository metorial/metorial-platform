import { JSONRPCMessage } from '@metorial/mcp-utils';
import { EngineMcpMessage } from '../mcp/message';
import { MCPMessageType } from '../mcp/types';

export abstract class EngineSessionConnectionBase {
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
