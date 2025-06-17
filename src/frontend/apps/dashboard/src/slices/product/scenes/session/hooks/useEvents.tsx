import { useCurrentInstance, useSessionEvents, useSessionMessages } from '@metorial/state';
import { RiErrorWarningLine } from '@remixicon/react';
import { useMemo } from 'react';
import { Entry } from '../components/entry';
import { Logs } from '../components/logs';
import { Message } from '../components/message';
import { useAggregatedMessages } from './useAggregatedMessages';

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
    return [
      ...(messages.data?.items ?? []).map((message, i) => ({
        component: <Message message={message} aggregatedMessages={aggregatedMessages} />,
        time: message.createdAt
      })),

      ...(events.data?.items ?? []).map((event, i) => {
        if (event.type == 'server_logs') {
          return {
            component: <Logs event={event} />,
            time: event.createdAt
          };
        }

        if (event.type == 'server_run_error') {
          return {
            component: (
              <Entry
                icon={<RiErrorWarningLine />}
                title={`${event.serverRunError?.code} - ${event.serverRunError?.message}`}
                time={event.createdAt}
                variant="error"
              />
            ),
            time: event.createdAt
          };
        }

        return null;
      })
    ];
  }, [events, messages, aggregatedMessages]);
};
