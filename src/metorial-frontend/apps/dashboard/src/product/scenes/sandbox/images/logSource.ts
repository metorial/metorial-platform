import type { LogSource } from '@metorial/log-viewer';
import { fetchSandboxImageBuildLogs, isSandboxLogsUnavailableError } from '@metorial/state';

export let createSandboxImageBuildLogSource = (
  instanceId: string,
  buildId: string
): LogSource => ({
  fetch: async options => {
    try {
      let page = await fetchSandboxImageBuildLogs({ instanceId, buildId, ...options });
      return {
        lines: page.lines.map(line => ({
          index: line.index,
          text: line.text,
          stream: line.source,
          timestamp: line.timestamp
        })),
        hasMore: page.hasMore,
        status: page.status,
        truncated: page.truncated,
        lineCount: page.lineCount
      };
    } catch (error) {
      if (isSandboxLogsUnavailableError(error))
        return { lines: [], hasMore: false, status: 'sealed', lineCount: 0 };
      throw error;
    }
  }
});
