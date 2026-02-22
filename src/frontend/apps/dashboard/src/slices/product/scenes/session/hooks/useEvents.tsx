import { DashboardInstanceSessionsEventsListOutput } from '@metorial/dashboard-sdk';
import { useCurrentInstance, useSessionEvents, useSessionMessages } from '@metorial/state';
import { RiErrorWarningLine } from '@remixicon/react';
import { useMemo } from 'react';
import { Entry } from '../components/entry';
import { Logs } from '../components/logs';
import { Message } from '../components/message';
import { useAggregatedMessages } from './useAggregatedMessages';

type SessionEvent = DashboardInstanceSessionsEventsListOutput['items'][number];

let isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

let getServerLogEventData = (event: SessionEvent): Record<string, unknown> | null => {
  if ('data' in event && isRecord(event.data)) return event.data;
  if (isRecord(event.message?.output)) return event.message.output;
  return null;
};

export let useEvents = (
  sessionId: string | undefined | null,
  opts: {
    serverSessionId?: string[] | string;
    serverRunId?: string[] | string;
    limit?: number;
  }
) => {
  let instance = useCurrentInstance();

  let events = useSessionEvents(sessionId ? instance.data?.id : undefined, sessionId, opts);
  let messages = useSessionMessages(
    sessionId ? instance.data?.id : undefined,
    sessionId,
    opts
  );

  let aggregatedMessages = useAggregatedMessages(messages.data?.items);

  return useMemo(() => {
    return {
      isLoading: events.isLoading || messages.isLoading,
      error: events.error || messages.error,
      data: [
        ...(messages.data?.items ?? []).map(message => ({
          component: (
            <Message message={message} aggregatedMessages={aggregatedMessages} />
          ),
          time: message.createdAt
        })),

        ...(events.data?.items ?? []).map(event => {
          if (event.type === 'server_logs') {
            return {
              component: (
                <Logs
                  event={{
                    data: getServerLogEventData(event),
                    createdAt: event.createdAt
                  }}
                />
              ),
              time: event.createdAt
            };
          }

          if (event.type === 'server_run_error') {
            return {
              component: (
                <Entry
                  icon={<RiErrorWarningLine />}
                  title={`${event.error?.code ?? 'Error'} - ${
                    event.error?.message ?? event.message?.error?.message ?? 'Unknown error'
                  }`}
                  time={event.createdAt}
                  variant="error"
                />
              ),
              time: event.createdAt
            };
          }

          return null;
        })
      ].filter(Boolean)
    };
  }, [events, messages, aggregatedMessages]);
};
