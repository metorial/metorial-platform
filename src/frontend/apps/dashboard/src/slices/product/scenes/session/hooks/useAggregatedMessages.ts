import { DashboardInstanceSessionsMessagesGetOutput } from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { useMemo } from 'react';

export interface AggregatedMessages {
  unifiedId: string;
  originalId: string;
  method?: string;

  request: DashboardInstanceSessionsMessagesGetOutput;
  response?: DashboardInstanceSessionsMessagesGetOutput;
}

export let useAggregatedMessages = (
  messages: DashboardInstanceSessionsMessagesGetOutput[] | undefined | null
) => {
  return useMemo(() => {
    if (!messages) return new Map<string, AggregatedMessages>();

    let map = new Map<string, AggregatedMessages>();

    for (let message of messages) {
      let mcpMsg = message.mcpMessage;
      if (!mcpMsg) continue;

      let msgId = String(mcpMsg.id);
      let current = (map.get(msgId) ?? {}) as AggregatedMessages;

      current.unifiedId = msgId;
      current.originalId = current.originalId ?? String(mcpMsg.originalId ?? mcpMsg.id);

      if (mcpMsg.method) {
        current.method = mcpMsg.method;
        current.request = message;
      } else {
        current.response = message;
      }

      map.set(msgId, current);
    }

    return map;
  }, [messages]);
};
