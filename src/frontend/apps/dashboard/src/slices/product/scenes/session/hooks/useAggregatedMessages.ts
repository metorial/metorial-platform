import { DashboardInstanceSessionsMessagesGetOutput } from '@metorial/dashboard-sdk';
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
      let mcpTransport = message.transport?.mcp;
      if (!mcpTransport) continue;

      let payload = (message.input ?? message.output ?? {}) as Record<string, any>;
      let msgId = String(payload.id ?? mcpTransport.id);
      let current = (map.get(msgId) ?? {}) as AggregatedMessages;

      current.unifiedId = msgId;
      current.originalId = current.originalId ?? String(payload.id ?? mcpTransport.id);

      if (typeof payload.method === 'string') {
        current.method = payload.method;
        current.request = message;
      } else {
        current.response = message;
      }

      map.set(msgId, current);
    }

    return map;
  }, [messages]);
};
