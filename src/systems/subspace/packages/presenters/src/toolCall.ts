import { getOffloadedSessionMessage } from '@metorial-subspace/connection-utils';
import {
  messageInputToToolCall,
  messageOutputToToolCall,
  type Provider,
  type ProviderSpecification,
  type ProviderTool,
  type ToolCall
} from '@metorial-subspace/db';
import { providerToolPresenter } from './providerTool';
import { sessionErrorPresenter } from './sessionError';
import type { SessionMessagePresenterProps } from './sessionMessage';

export type ToolCallPresenterProps = ToolCall & {
  tool: ProviderTool & {
    provider: Provider;
    specification: Omit<ProviderSpecification, 'value'>;
  };
  message: SessionMessagePresenterProps;
};

export let toolCallPresenter = async (toolCall: ToolCallPresenterProps) => {
  if (toolCall.message.isOffloadedToStorage) {
    let offloaded = await getOffloadedSessionMessage(toolCall.message);
    if (offloaded) {
      toolCall.message.input = offloaded.input;
      toolCall.message.output = offloaded.output;
    }
  }

  return {
    object: 'tool_call',

    id: toolCall.id,
    toolKey: toolCall.toolKey,

    type: 'tool_call',
    status: toolCall.message.status,
    source: toolCall.message.source,
    transport: toolCall.message.transport,

    sessionId: toolCall.message.session.id,
    messageId: toolCall.message.id,
    providerId: toolCall.tool.provider.id,
    sessionProviderId: toolCall.message.sessionProvider?.id || null,
    connectionId: toolCall.message.connection?.id || null,
    providerRunId: toolCall.message.providerRun?.id || null,

    tool: providerToolPresenter(toolCall.tool),

    input: toolCall.message.input
      ? await messageInputToToolCall(toolCall.message.input, toolCall.message)
      : null,
    output: toolCall.message.output
      ? await messageOutputToToolCall(toolCall.message.output, toolCall.message)
      : null,

    error: toolCall.message.error ? await sessionErrorPresenter(toolCall.message.error) : null,

    createdAt: toolCall.createdAt
  };
};
