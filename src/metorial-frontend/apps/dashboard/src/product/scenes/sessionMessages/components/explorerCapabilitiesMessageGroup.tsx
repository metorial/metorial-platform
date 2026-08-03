import { RenderDate } from '@metorial/ui';
import { RiArrowRightSLine, RiToolsLine } from '@remixicon/react';
import { AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import type { AggregatedMessages } from '../../session/hooks/useAggregatedMessages';
import {
  AnimatedGroupContent,
  GroupActions,
  GroupContent,
  GroupTitle,
  GroupTrigger,
  GroupWrapper
} from '../styles';
import type { DashboardInstanceSessionsMessagesGetOutput } from '../types';
import { Message } from './message';

export let ExplorerCapabilitiesMessageGroup = ({
  aggregatedMessages,
  clientName,
  messages
}: {
  aggregatedMessages: Map<string, AggregatedMessages>;
  clientName: string;
  messages: DashboardInstanceSessionsMessagesGetOutput[];
}) => {
  let [isOpen, setIsOpen] = useState(false);
  if (messages.length === 0) return null;

  let firstMessage = messages[0];

  return (
    <GroupWrapper>
      <GroupTrigger onClick={() => setIsOpen(v => !v)} type="button">
        <RiToolsLine />
        <span>
          <GroupTitle>
            <strong>{clientName} explored capabilities</strong>

            <RiArrowRightSLine
              size={16}
              style={{
                transform: `rotate(${isOpen ? 90 : 0}deg)`,
                transition: 'transform 200ms ease'
              }}
            />
          </GroupTitle>
        </span>

        <GroupActions>
          <time>
            <RenderDate date={firstMessage.createdAt} />
          </time>
        </GroupActions>
      </GroupTrigger>

      <AnimatePresence initial={false}>
        {isOpen && (
          <AnimatedGroupContent
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <GroupContent>
              {messages.map(message => (
                <Message
                  key={message.id}
                  aggregatedMessages={aggregatedMessages}
                  message={message}
                />
              ))}
            </GroupContent>
          </AnimatedGroupContent>
        )}
      </AnimatePresence>
    </GroupWrapper>
  );
};
