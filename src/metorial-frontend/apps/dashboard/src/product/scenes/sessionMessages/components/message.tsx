import { useCurrentInstance, useSessionMessage } from '@metorial/state';
import { Button } from '@metorial/ui';
import { useInView } from 'framer-motion';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { formatBytes } from '../../sandbox/lib/format';
import { Entry } from '../../session/components/entry';
import type { AggregatedMessages } from '../../session/hooks/useAggregatedMessages';
import { getMessagePresentation } from '../presentations/getMessagePresentation';
import { MessageStack, OmittedNotice } from '../styles';
import type { DashboardInstanceSessionsMessagesGetOutput } from '../types';
import {
  getMessageMethod,
  getMessagePayload,
  getMethodResult,
  getPresentBody,
  isOmittedBody,
  shouldRenderStandaloneMessage
} from '../utils';
import { MessageCard } from './messageCard';

let getBodySourceMessages = ({
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

  return {
    agg,
    inputMessage: agg?.request ?? (message.input ? message : undefined),
    outputMessage: agg?.response ?? (message.output ? message : undefined)
  };
};

export let useMessagePresentation = ({
  aggregatedMessages,
  fullInputMessage,
  fullOutputMessage,
  message
}: {
  message: DashboardInstanceSessionsMessagesGetOutput;
  aggregatedMessages: Map<string, AggregatedMessages>;
  fullInputMessage?: DashboardInstanceSessionsMessagesGetOutput;
  fullOutputMessage?: DashboardInstanceSessionsMessagesGetOutput;
}) => {
  let sources = getBodySourceMessages({ aggregatedMessages, message });
  if (!sources) return null;

  if (!shouldRenderStandaloneMessage(message, aggregatedMessages)) {
    return null;
  }

  let agg = sources.agg;
  let inputMessage = fullInputMessage ?? sources.inputMessage;
  let outputMessage = fullOutputMessage ?? sources.outputMessage;

  let input = getPresentBody(inputMessage?.input);
  let output = getPresentBody(outputMessage?.output);
  let method = getMessageMethod(message, aggregatedMessages) ?? message.type ?? 'message';
  let isResponseOnly = !input && !isOmittedBody(inputMessage?.input) && !!output;
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
    inputMessage,
    isToolError,
    messageError,
    output,
    outputMessage,
    position,
    presentation
  };
};

let getOmittedBodies = (
  inputMessage: DashboardInstanceSessionsMessagesGetOutput | undefined,
  outputMessage: DashboardInstanceSessionsMessagesGetOutput | undefined
) => {
  let omitted: { label: string; size: number | null }[] = [];

  if (isOmittedBody(inputMessage?.input)) {
    omitted.push({ label: 'request', size: inputMessage.input.size });
  }

  if (isOmittedBody(outputMessage?.output)) {
    omitted.push({ label: 'response', size: outputMessage.output.size });
  }

  return omitted;
};

let describeOmittedBodies = (omitted: { label: string; size: number | null }[]) =>
  omitted
    .map(body =>
      body.size == null ? body.label : `${body.label} (${formatBytes(body.size)})`
    )
    .join(' and ');

let OmittedBodiesNotice = ({
  hasError,
  isLoading,
  isTooLarge,
  omitted,
  onLoad
}: {
  hasError: boolean;
  isLoading: boolean;
  isTooLarge: boolean;
  omitted: { label: string; size: number | null }[];
  onLoad?: () => void;
}) => {
  let description = describeOmittedBodies(omitted);
  let isPlural = omitted.length > 1;

  return (
    <OmittedNotice>
      <span>
        {isTooLarge
          ? `The ${description} ${isPlural ? 'are' : 'is'} too large to display in the dashboard.`
          : hasError
            ? `The full ${description} could not be loaded.`
            : `The ${description} ${isPlural ? 'were' : 'was'} left out of the timeline because ${isPlural ? 'they are' : 'it is'} large.`}
      </span>

      {!isTooLarge && !hasError && onLoad && (
        <Button size="1" variant="outline" type="button" loading={isLoading} onClick={onLoad}>
          Load Full Message
        </Button>
      )}
    </OmittedNotice>
  );
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
  overviewSections?: ReturnType<typeof getMessagePresentation>['overviewSections'];
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
  let instance = useCurrentInstance();
  let [loadFullBodies, setLoadFullBodies] = useState(false);

  let sources = getBodySourceMessages({ aggregatedMessages, message });
  let instanceId = instance.data?.id;
  let fullInputMessageId =
    loadFullBodies && instanceId && isOmittedBody(sources?.inputMessage?.input)
      ? (sources?.inputMessage?.id ?? null)
      : null;
  let fullOutputMessageId =
    loadFullBodies && instanceId && isOmittedBody(sources?.outputMessage?.output)
      ? (sources?.outputMessage?.id ?? null)
      : null;

  let fullInputMessage = useSessionMessage(instanceId, fullInputMessageId);
  let fullOutputMessage = useSessionMessage(instanceId, fullOutputMessageId);

  let presentationData = useMessagePresentation({
    aggregatedMessages,
    message,
    fullInputMessage: fullInputMessage.data ?? undefined,
    fullOutputMessage: fullOutputMessage.data ?? undefined
  });
  if (!presentationData) return null;

  let {
    agg,
    date,
    hasError,
    input,
    inputMessage,
    isToolError,
    messageError,
    output,
    outputMessage,
    position,
    presentation
  } = presentationData;

  let omitted = getOmittedBodies(inputMessage, outputMessage);
  let isLoadingFullBodies =
    (!!fullInputMessageId && fullInputMessage.isLoading) ||
    (!!fullOutputMessageId && fullOutputMessage.isLoading);
  let hasFullBodiesError = !!fullInputMessage.error || !!fullOutputMessage.error;
  let hasLoadedFullBodies =
    loadFullBodies &&
    !isLoadingFullBodies &&
    !hasFullBodiesError &&
    (!!fullInputMessage.data || !!fullOutputMessage.data);

  return (
    <MessageStack>
      <Entry
        icon={presentation.summaryIcon}
        title={presentation.summaryText}
        time={date}
        variant={hasError ? 'error' : undefined}
      />

      {omitted.length > 0 && (
        <OmittedBodiesNotice
          omitted={omitted}
          hasError={hasFullBodiesError}
          isLoading={isLoadingFullBodies}
          isTooLarge={hasLoadedFullBodies}
          onLoad={instanceId ? () => setLoadFullBodies(true) : undefined}
        />
      )}

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
