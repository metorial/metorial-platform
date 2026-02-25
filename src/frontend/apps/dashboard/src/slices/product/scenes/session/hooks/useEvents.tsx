import { useCurrentInstance, useSessionEvents, useSessionMessages } from '@metorial/state';
import { RiErrorWarningLine } from '@remixicon/react';
import { useMemo } from 'react';
import { Entry } from '../components/entry';
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
          if (event.type === 'error_occurred') {
            let errorMsg =
              event.error?.code && event.error?.message
                ? `${event.error.code} - ${event.error.message}`
                : event.error?.message ?? 'Unknown error';
            return {
              component: (
                <Entry
                  icon={<RiErrorWarningLine />}
                  title={`Error: ${errorMsg}`}
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
