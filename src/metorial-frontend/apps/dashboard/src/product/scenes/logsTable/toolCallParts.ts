import { defineStatus } from '@metorial/data-list';

export let toolCallStatus = defineStatus({
  succeeded: { label: 'Succeeded', color: 'green' },
  failed: { label: 'Failed', color: 'red' },
  waiting_for_response: { label: 'Waiting for response', color: 'orange' }
});

export let toolCallLinkQuery = (toolCall: {
  id: string;
  messageId: string;
  connectionId: string | null;
}) =>
  Object.fromEntries(
    Object.entries({
      connection_id: toolCall.connectionId ?? undefined,
      message_id: toolCall.messageId,
      tool_call_id: toolCall.id
    }).filter(([, value]) => !!value)
  ) as Record<string, string>;
