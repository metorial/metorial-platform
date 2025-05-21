import { SessionsServerSessionsGetOutput } from '@metorial/core';
import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useServerRuns,
  useSessionEvents,
  useSessionMessages
} from '@metorial/state';
import { theme } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiErrorWarningLine, RiRadarLine, RiServerLine } from '@remixicon/react';
import { motion, useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useAggregatedMessages } from '../hooks/useAggregatedMessages';
import { UseLock } from '../hooks/useLock';
import { Entry } from './entry';
import { ItemList } from './itemList';
import { Logs } from './logs';
import { Message } from './message';

let Wrapper = styled(motion.div)`
  border-radius: 8px;
  border: 1px solid ${theme.colors.gray400};
  background: ${theme.colors.background};
  overflow: hidden;
  margin-left: -20px;
  margin-right: -20px;
`;

let Header = styled.header`
  border-bottom: 1px solid ${theme.colors.gray400};
  /* background: ${theme.colors.gray100}; */
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: ${theme.colors.gray800};

  span {
    font-size: 12px;
    font-weight: 500;
  }
`;

let Main = styled.main`
  padding: 20px;
`;

export let ServerSession = ({
  serverSession,
  useLock
}: {
  serverSession: SessionsServerSessionsGetOutput;
  useLock: UseLock;
}) => {
  let ref = useRef<HTMLDivElement>(null);
  let inView = useInView(ref, {});

  let [locked, setLocked] = useState(true);
  let [canFetch, setCanFetch] = useState(false);

  useEffect(() => {
    if (inView && !locked) setCanFetch(true);
  }, [inView, locked]);

  useLock(() => setLocked(false));

  let instance = useCurrentInstance();
  let events = useSessionEvents(
    canFetch ? instance.data?.id : undefined,
    canFetch ? serverSession.session.id : undefined,
    { serverSessionIds: [serverSession.id] }
  );
  let messages = useSessionMessages(
    canFetch ? instance.data?.id : undefined,
    canFetch ? serverSession.session.id : undefined,
    { serverSessionIds: [serverSession.id] }
  );
  let serverRuns = useServerRuns(canFetch ? instance.data?.id : undefined, {
    serverSessionIds: [serverSession.id]
  });

  let aggregatedMessages = useAggregatedMessages(messages.data?.items);

  if (serverRuns.data?.items.length === 0) return null;

  return (
    <Wrapper
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={canFetch ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      style={{
        height: canFetch ? 'auto' : 500
      }}
    >
      <Header>
        <span>{serverSession.serverDeployment.name ?? serverSession.server.name}</span>
        <span>
          <ID id={serverSession.id} />
        </span>
      </Header>

      <Main>
        {renderWithLoader({ events, messages, serverRuns })(
          ({ events, messages, serverRuns }) => (
            <ItemList
              items={[
                {
                  component: (
                    <Entry
                      icon={<RiRadarLine />}
                      title={`Client connected`}
                      time={serverSession.createdAt}
                    />
                  ),
                  time: serverSession.createdAt
                },

                ...serverRuns.data.items.flatMap(serverRun => [
                  {
                    component: (
                      <Entry
                        icon={<RiServerLine />}
                        title={`Server deployments ${serverRun.serverDeployment.name} started`}
                        time={serverRun.startedAt ?? serverRun.createdAt}
                      />
                    ),
                    time: serverRun.startedAt ?? serverRun.createdAt
                  },

                  serverRun.stoppedAt && {
                    component: (
                      <Entry
                        icon={<RiServerLine />}
                        title={`Server deployments ${serverRun.serverDeployment.name} stopped`}
                        time={serverRun.startedAt ?? serverRun.createdAt}
                      />
                    ),
                    time: serverRun.stoppedAt
                  }
                ]),

                ...messages.data.items.map((message, i) => ({
                  component: (
                    <Message message={message} aggregatedMessages={aggregatedMessages} />
                  ),
                  time: message.createdAt
                })),

                ...events.data.items.map((event, i) => {
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
              ]}
            />
          )
        )}
      </Main>
    </Wrapper>
  );
};
