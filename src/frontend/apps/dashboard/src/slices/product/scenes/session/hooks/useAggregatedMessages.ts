import { DashboardInstanceSessionsMessagesGetOutput } from '@metorial/generated/src/mt_2025_01_01_dashboard';
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
      let current = (map.get(message.mcpMessage.id) ?? {}) as AggregatedMessages;

      current.unifiedId = message.mcpMessage.id;
      current.originalId =
        current.originalId ?? message.mcpMessage.originalId ?? message.mcpMessage.id;

      if (message.mcpMessage.method) {
        current.method = message.mcpMessage.method;
        current.request = message;
      } else {
        current.response = message;
      }

      map.set(message.mcpMessage.id, current);
    }

    return map;
  }, [messages]);
};
