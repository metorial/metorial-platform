import { conduitResultToMcpMessage } from '@metorial-subspace/connection-utils';
import type { CallToolProps, InitProps, SenderMangerProps } from '../sender';
import { SenderConnection } from '../sender/connection';
import type { CreateMessageProps } from '../shared/createMessage';

export class McpManager {
  private constructor(private readonly _connection: SenderConnection) {}

  static async create(d: Omit<SenderMangerProps, 'transport'>): Promise<McpManager> {
    return new McpManager(
      await SenderConnection.create({
        ...d,
        transport: 'mcp'
      })
    );
  }

  get session() {
    return this._connection.session;
  }

  get connection() {
    return this._connection.connection;
  }

  senderListener(d: { selectedChannels: 'all' | 'broadcast'; replayFromMessageId?: string }) {
    let listener = this._connection.listener(d);

    return {
      close: () => listener.close(),
      async *[Symbol.asyncIterator]() {
        for await (let msg of listener) {
          let result = await conduitResultToMcpMessage(msg);

          // Ignore targeted messages if we only want broadcasts
          if (d.selectedChannels === 'broadcast' && msg.channel === 'targeted_response') {
            continue;
          }

          yield { mcp: result, message: msg.message };
        }
      }
    };
  }

  async getConnection() {
    if (this.connection) return this.connection;
    return await this._connection.createConnection();
  }

  listToolsIncludingInternal() {
    return this._connection.listToolsIncludingInternal();
  }

  listToolsIncludingInternalAndNonAllowed() {
    return this._connection.listToolsIncludingInternalAndNonAllowed();
  }

  listTools() {
    return this._connection.listTools();
  }

  listProviders() {
    return this._connection.listProviders();
  }

  getToolById(d: { toolId: string }) {
    return this._connection.getToolById(d);
  }

  callTool(d: CallToolProps) {
    return this._connection.callTool(d);
  }

  initialize(d: InitProps) {
    return this._connection.initialize(d);
  }

  createConnection() {
    return this._connection.createConnection();
  }

  disableConnection() {
    return this._connection.disableConnection();
  }

  createMessage(d: CreateMessageProps) {
    return this._connection.createMessage(d);
  }
}
