import {
  RiCornerUpRightDoubleLine,
  RiErrorWarningLine,
  RiPlugLine,
  RiRadarLine,
  RiSendPlane2Line,
  RiServerLine
} from '@remixicon/react';
import { memo } from 'react';
import { ProviderInvocationEntry } from '../../providerInvocations';
import { Entry } from '../../session/components/entry';
import { ProviderRunLogs } from '../../session/components/providerRunLogs';
import { ExplorerCapabilitiesMessageGroup, Message } from '../../sessionMessages';
import { TimelineItemData, TimelineRowContext } from '../types';

let TimelineEventRow = memo(
  ({ event }: { event: TimelineItemData & { kind: 'event' } }) => {
    let type = event.event.type as string;

    if (type === 'error_occurred') {
      let errorMsg =
        event.event.error?.code && event.event.error?.message
          ? `${event.event.error.code} - ${event.event.error.message}`
          : (event.event.error?.message ?? event.event.warning?.message ?? null);
      return (
        <Entry
          icon={<RiErrorWarningLine />}
          title={errorMsg ? `Error: ${errorMsg}` : 'Error occurred'}
          time={event.time}
          variant="error"
        />
      );
    }

    if (type === 'warning_occurred') {
      let warningMsg =
        event.event.warning?.code && event.event.warning?.message
          ? `${event.event.warning.code} - ${event.event.warning.message}`
          : (event.event.warning?.message ?? null);
      return (
        <Entry
          icon={<RiErrorWarningLine />}
          title={warningMsg ? `warning: ${warningMsg}` : 'warning occurred'}
          time={event.time}
          variant="warning"
        />
      );
    }

    if (type === 'provider_run_started') {
      return (
        <Entry icon={<RiServerLine />} title="Provider started" time={event.time} />
      );
    }

    if (type === 'provider_run_stopped') {
      return (
        <Entry icon={<RiServerLine />} title="Provider stopped" time={event.time} />
      );
    }

    if (type === 'connection_disconnected') {
      return (
        <Entry icon={<RiPlugLine />} title="Connection disconnected" time={event.time} />
      );
    }

    return null;
  }
);

TimelineEventRow.displayName = 'TimelineEventRow';

export let TimelineItemRow = memo(
  ({ context, item }: { context: TimelineRowContext; item: TimelineItemData }) => {
    switch (item.kind) {
      case 'session_created':
        return (
          <Entry
            icon={<RiCornerUpRightDoubleLine />}
            title="Session created"
            time={item.time}
          />
        );

      case 'connection_marker':
        return (
          <Entry
            icon={item.variant === 'connected' ? <RiRadarLine /> : <RiSendPlane2Line />}
            title={
              item.variant === 'connected'
                ? 'Client connected'
                : 'Session connection created'
            }
            time={item.time}
          />
        );

      case 'message': {
        let message = context.messageById.get(item.messageId);
        if (!message) return null;
        return (
          <Message
            message={message}
            aggregatedMessages={context.aggregatedMessages}
            deferMount={false}
          />
        );
      }

      case 'explorer_capabilities': {
        let messages = item.messageIds
          .map(id => context.messageById.get(id))
          .filter((message): message is NonNullable<typeof message> => !!message);
        if (!messages.length) return null;
        return (
          <ExplorerCapabilitiesMessageGroup
            aggregatedMessages={context.aggregatedMessages}
            clientName={context.clientName}
            messages={messages}
            deferMessageMount={false}
          />
        );
      }

      case 'event':
        return <TimelineEventRow event={item} />;

      case 'provider_run_logs':
        return <ProviderRunLogs providerRunId={item.providerRunId} />;

      case 'invocation': {
        let invocation = context.invocationById.get(item.invocationId);
        if (!invocation) return null;
        return <ProviderInvocationEntry invocation={invocation} />;
      }

      default:
        return null;
    }
  }
);

TimelineItemRow.displayName = 'TimelineItemRow';
