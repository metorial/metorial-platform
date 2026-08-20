import { useInView } from 'framer-motion';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Entry } from '../../session/components/entry';
import type { AggregatedMessages } from '../../session/hooks/useAggregatedMessages';
import { getMessagePresentation } from '../presentations/getMessagePresentation';
import { MessageStack } from '../styles';
import type { DashboardInstanceSessionsMessagesGetOutput } from '../types';
import {
  getMessageMethod,
  getMessagePayload,
  getMethodResult,
  shouldRenderStandaloneMessage
} from '../utils';
import { MessageCard } from './messageCard';

export let useMessagePresentation = ({
  aggregatedMessages,
  message
}: {
  message: DashboardInstanceSessionsMessagesGetOutput;
  aggregatedMessages: Map<string, AggregatedMessages>;
}) => {
  let transportMcp = message.transport?.mcp;
  if (!transportMcp) return null;

  let payload = getMessagePayload(message);
  let messageKey = String(payload.id ?? transportMcp.id);
  let agg = aggregatedMessages.get(messageKey);

  if (!shouldRenderStandaloneMessage(message, aggregatedMessages)) {
    return null;
  }

  let inputMessage = agg?.request ?? (message.input ? message : undefined);
  let outputMessage = agg?.response ?? (message.output ? message : undefined);

  let input = (inputMessage?.input ?? null) as Record<string, any> | null;
  let output = (outputMessage?.output ?? null) as Record<string, any> | null;
  let method = getMessageMethod(message, aggregatedMessages) ?? message.type ?? 'message';
  let isResponseOnly = !input && !!output;
  let date = inputMessage?.createdAt ?? outputMessage?.createdAt ?? message.createdAt;
  let position = isResponseOnly
    ? 'server'
    : (inputMessage?.senderParticipant?.type ?? 'client');
  let presentation = getMessagePresentation({
    input,
    message,
    method,
    output
  });
  let isToolError = getMethodResult(output)?.isError === true;

  let messageError = outputMessage?.error ?? message.error ?? undefined;
  let hasError = !!messageError || isToolError;

  return {
    agg,
    date,
    hasError,
    input,
    isToolError,
    messageError,
    output,
    position,
    presentation
  };
};

let MessageBody = ({
  date,
  defaultViewMode,
  deferMount = true,
  error,
  id,
  input,
  isToolError,
  label,
  output,
  overviewSections,
  position
}: {
  date: Date;
  defaultViewMode?: 'overview' | 'properties' | 'raw';
  /** Set to false when an outer container already gates mounting (e.g. row virtualization) -- an extra independent defer here just reintroduces a second, uncoordinated pop-in. */
  deferMount?: boolean;
  error?: DashboardInstanceSessionsMessagesGetOutput['error'];
  id?: string;
  input?: Record<string, any> | null;
  isToolError?: boolean;
  label: React.ReactNode;
  output?: Record<string, any> | null;
  overviewSections?: ReturnType<
    typeof getMessagePresentation
  >['overviewSections'];
  position: string;
}) => {
  let ref = useRef<HTMLDivElement>(null);
  let inView = useInView(ref, { margin: '200px 0px' });
  let [canRender, setCanRender] = useState(!deferMount);

  useEffect(() => {
    if (!deferMount || inView) setCanRender(true);
  }, [deferMount, inView]);

  return (
    <div ref={ref}>
      {canRender ? (
        <MessageCard
          id={id}
          label={label}
          input={input}
          output={output}
          date={date}
          position={position}
          overviewSections={overviewSections}
          defaultViewMode={defaultViewMode}
          error={error}
          isToolError={isToolError}
        />
      ) : null}
    </div>
  );
};

export let Message = ({
  aggregatedMessages,
  deferMount = true,
  message
}: {
  message: DashboardInstanceSessionsMessagesGetOutput;
  aggregatedMessages: Map<string, AggregatedMessages>;
  /** Set to false when an outer container already gates mounting (e.g. row virtualization). */
  deferMount?: boolean;
}) => {
  let presentationData = useMessagePresentation({ aggregatedMessages, message });
  if (!presentationData) return null;

  let {
    agg,
    date,
    hasError,
    input,
    isToolError,
    messageError,
    output,
    position,
    presentation
  } = presentationData;

  return (
    <MessageStack>
      <Entry
        icon={presentation.summaryIcon}
        title={presentation.summaryText}
        time={date}
        variant={hasError ? 'error' : undefined}
      />

      {!presentation.hideCard && (
        <MessageBody
          id={agg?.originalId}
          label={presentation.label}
          input={input}
          output={output}
          date={date}
          position={position}
          overviewSections={presentation.overviewSections}
          defaultViewMode={presentation.defaultViewMode}
          deferMount={deferMount}
          error={messageError}
          isToolError={isToolError}
        />
      )}
    </MessageStack>
  );
};
