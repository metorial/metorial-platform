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

export let Message = ({
  message,
  aggregatedMessages
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

  return (
    <MessageStack>
      <Entry
        icon={presentation.summaryIcon}
        title={presentation.summaryText}
        time={date}
        variant={hasError ? 'error' : undefined}
      />

      {!presentation.hideCard && (
        <MessageCard
          id={agg?.originalId}
          label={presentation.label}
          input={input}
          output={output}
          date={date}
          position={position}
          overviewSections={presentation.overviewSections}
          defaultViewMode={presentation.defaultViewMode}
          error={messageError}
          isToolError={isToolError}
        />
      )}
    </MessageStack>
  );
};
