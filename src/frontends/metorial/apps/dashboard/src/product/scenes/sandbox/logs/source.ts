import type { LogSource } from '@metorial/log-viewer';
import {
  fetchSandboxMachineInstanceLogs,
  isSandboxLogsUnavailableError
} from '@metorial/state';

export let createSandboxMachineLogSource = (input: {
  instanceId: string;
  machineId: string;
  machineInstanceId: string;
  isLive?: () => boolean;
}): LogSource => ({
  fetch: async options => {
    try {
      let page = await fetchSandboxMachineInstanceLogs({
        instanceId: input.instanceId,
        machineId: input.machineId,
        machineInstanceId: input.machineInstanceId,
        ...options
      });
      return {
        lines: page.lines.map(line => ({
          index: line.index,
          text: line.text,
          timestamp: line.timestamp,
          stream: line.source
        })),
        hasMore: page.hasMore,
        status: page.status,
        truncated: page.truncated,
        lineCount: page.lineCount
      };
    } catch (error) {
      if (!isSandboxLogsUnavailableError(error)) throw error;
      return {
        lines: [],
        hasMore: false,
        status: input.isLive?.() ? 'open' : 'sealed',
        lineCount: 0
      };
    }
  }
});
