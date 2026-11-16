import type { ServerConnection } from '@mtsrc/mcp-runtime-db';
import { connectionLogsBucketRecord, storage } from '../storage';

export interface OffloadedConnectionLogs {
  v: 1;
  connectionId: string;
  logs: McpRuntimePrismaJson.ServerConnectionLogLines;
}

export let offload = {
  offloadConnectionLogs: async (
    connection: ServerConnection,
    logs: McpRuntimePrismaJson.ServerConnectionLogLines
  ) => {
    let offloaded: OffloadedConnectionLogs = {
      v: 1,
      connectionId: connection.id,
      logs
    };

    await storage.putObject(
      connectionLogsBucketRecord.bucket,
      `logs/${connection.id}/data`,
      JSON.stringify(offloaded)
    );
  },

  getOffloadedConnectionLogs: async (connection: ServerConnection) => {
    try {
      let res = await storage.getObject(
        connectionLogsBucketRecord.bucket,
        `logs/${connection.id}/data`
      );
      let str = res.data.toString('utf-8');
      return JSON.parse(str) as OffloadedConnectionLogs;
    } catch (e) {
      return null;
    }
  }
};

export let getOffloadedConnectionLogs = offload.getOffloadedConnectionLogs;
