import { JSONRPCMessage } from '@metorial/mcp-utils';
import { EngineMcpMessage } from '../mcp/message';
import { MCPMessageType } from '../mcp/types';
import { EngineSessionConnection } from './connection';
import { EngineSessionConnectionInternal } from './internal';

export class EngineSessionProxy extends EngineSessionConnection {
  #abort = new AbortController();

  constructor(private readonly inner: EngineSessionConnectionInternal) {
    super();

    inner.registerProxy(this);
  }

  getMcpStream(i: {
    replayAfterUuid?: string;
    onlyIds?: string[];
    onlyMessageTypes?: MCPMessageType[];
    signal?: AbortSignal;
  }) {
    return this.inner.getMcpStream({
      replayAfterUuid: i.replayAfterUuid,
      onlyIds: i.onlyIds,
      onlyMessageTypes: i.onlyMessageTypes,
      signal: i.signal ? AbortSignal.any([this.#abort.signal, i.signal]) : this.#abort.signal
    });
  }

  sendMcpMessageStream(
    raw: JSONRPCMessage[],
    opts: {
      includeResponses?: boolean;
      signal?: AbortSignal;
    }
  ): AsyncGenerator<EngineMcpMessage> {
    return this.inner.sendMcpMessageStream(raw, {
      includeResponses: opts.includeResponses,
      signal: opts.signal
        ? AbortSignal.any([this.#abort.signal, opts.signal])
        : this.#abort.signal
    });
  }

  sendMcpMessage(raw: JSONRPCMessage[]): Promise<void> {
    return this.inner.sendMcpMessage(raw);
  }

  close(): void {
    this.#abort.abort();
    this.inner.unregisterProxy(this);

    if (EngineSessionConnectionInternal.canClose(this.inner)) {
      this.inner.close();
    }
  }
}
