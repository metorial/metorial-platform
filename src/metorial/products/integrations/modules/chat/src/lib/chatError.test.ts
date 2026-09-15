import { chatError, wrapChatError } from '@slates/adapter-chat';
import { describe, expect, it } from 'vitest';
import {
  chatCallErrorToServiceError,
  describeChatFailure,
  isChatCallError,
  shouldRetryChatCall,
  unwrapChatCall
} from './chatError';

/**
 * Failures arrive here as JSON, never as a live instance: the error crosses the
 * slates hub, the provider backend and the message store on the way. Serializing
 * is what makes these tests exercise the real path.
 */
let failureOutput = (error: unknown) => JSON.parse(JSON.stringify(error));

let failure = (error: unknown) =>
  ({ result: { type: 'failure' as const, output: failureOutput(error) } }) as any;

let success = <T>(output: T) => ({ result: { type: 'success' as const, output } }) as any;

describe('chatCallErrorToServiceError', () => {
  it('maps a missing target to a 404 naming the entity', () => {
    let error = chatCallErrorToServiceError(
      failureOutput(chatError('chat.channel.not_found', { target: 'C123' }))
    );

    expect(error.data.status).toBe(404);
    expect(error.data.code).toBe('not_found');
    // The target id from the envelope becomes the not-found id.
    expect(error.data.entity).toBe('chatChannel');
    expect(error.data.id).toBe('C123');
  });

  it('maps auth and access failures to 403', () => {
    for (let code of [
      'chat.auth.missing_scope',
      'chat.auth.expired',
      'chat.access.not_a_member',
      'chat.access.forbidden'
    ] as const) {
      expect(chatCallErrorToServiceError(failureOutput(chatError(code))).data.status).toBe(
        403
      );
    }
  });

  it('maps a rate limit to 429', () => {
    let error = chatCallErrorToServiceError(
      failureOutput(chatError('chat.rate_limit.exceeded', { retryAfterMs: 30_000 }))
    );

    expect(error.data.status).toBe(429);
    expect(error.data.code).toBe('chat.rate_limit.exceeded');
  });

  it('maps state conflicts to 409', () => {
    for (let code of [
      'chat.access.channel_archived',
      'chat.message.not_editable',
      'chat.reaction.already_exists'
    ] as const) {
      expect(chatCallErrorToServiceError(failureOutput(chatError(code))).data.status).toBe(
        409
      );
    }
  });

  it('falls back to a bad request for anything else', () => {
    let error = chatCallErrorToServiceError(failureOutput(chatError('chat.content.empty')));

    expect(error.data.status).toBe(400);
    expect(error.data.code).toBe('chat.content.empty');
  });

  it('uses the catalog sentence, not the raw upstream message', () => {
    // The payload message carries provider detail meant for logs.
    let raw = wrapChatError(
      'chat.channel.not_found',
      new Error('Slack API error (conversations.info): channel_not_found')
    );

    let error = chatCallErrorToServiceError(failureOutput(raw));
    expect(error.data.message).not.toContain('conversations.info');
  });

  it('keeps prior behavior for a failure with no chat classification', () => {
    // Timeouts and normalized provider errors reach this same channel.
    let error = chatCallErrorToServiceError(
      { code: 'timeout', message: 'exceeded tenant timeout of 30000ms' },
      { code: 'chat_workspace_list_failed', message: 'Failed to list workspaces.' }
    );

    expect(error.data.status).toBe(400);
    expect(error.data.code).toBe('chat_workspace_list_failed');
    expect(error.data.message).toBe('Failed to list workspaces.');
  });
});

describe('unwrapChatCall', () => {
  it('returns the output on success', () => {
    expect(unwrapChatCall(success({ workspaces: [1, 2] }))).toEqual({ workspaces: [1, 2] });
  });

  it('throws the mapped service error on failure', () => {
    expect(() => unwrapChatCall(failure(chatError('chat.workspace.not_found')))).toThrow();

    try {
      unwrapChatCall(failure(chatError('chat.auth.missing_scope')));
    } catch (error: any) {
      expect(error.data.status).toBe(403);
    }
  });
});

describe('shouldRetryChatCall', () => {
  it('retries transient failures', () => {
    expect(shouldRetryChatCall(failureOutput(chatError('chat.rate_limit.exceeded')))).toBe(
      true
    );
    expect(shouldRetryChatCall(failureOutput(chatError('chat.provider.unavailable')))).toBe(
      true
    );
  });

  it('does not retry terminal failures', () => {
    // The old blanket QueueRetryError burned every attempt on these.
    expect(shouldRetryChatCall(failureOutput(chatError('chat.auth.invalid')))).toBe(false);
    expect(shouldRetryChatCall(failureOutput(chatError('chat.auth.missing_scope')))).toBe(
      false
    );
    expect(shouldRetryChatCall(failureOutput(chatError('chat.channel.not_found')))).toBe(
      false
    );
  });

  it('retries when the transient reason is in the cause chain', () => {
    let inner = chatError('chat.rate_limit.exceeded', { retryAfterMs: 5_000 });
    let outer = wrapChatError('chat.event.hydration_failed', inner);

    expect(shouldRetryChatCall(failureOutput(outer))).toBe(true);
  });

  it('retries a failure with no classification', () => {
    // Unclassified means transport level, which is the most transient kind.
    expect(shouldRetryChatCall({ code: 'timeout', message: 'timed out' })).toBe(true);
    expect(shouldRetryChatCall({ code: 'provider_unreachable', message: 'down' })).toBe(true);
  });
});

describe('isChatCallError', () => {
  it('matches the primary code, and the chain when asked', () => {
    let output = failureOutput(
      wrapChatError('chat.event.hydration_failed', chatError('chat.channel.not_found'))
    );

    expect(isChatCallError(output, 'chat.event.hydration_failed')).toBe(true);
    expect(isChatCallError(output, 'chat.channel.not_found')).toBe(false);
    expect(isChatCallError(output, 'chat.channel.not_found', { includeCauses: true })).toBe(
      true
    );
  });
});

describe('describeChatFailure', () => {
  it('collects the fields worth logging', () => {
    let output = failureOutput(
      wrapChatError(
        'chat.event.hydration_failed',
        chatError('chat.channel.not_found', {
          target: 'C1',
          provider: { code: 'channel_not_found' }
        })
      )
    );

    expect(describeChatFailure(output)).toMatchObject({
      code: 'chat.event.hydration_failed',
      providerCode: 'channel_not_found',
      retryable: true,
      chain: ['chat.event.hydration_failed', 'chat.channel.not_found']
    });
  });

  it('degrades for an unclassified failure', () => {
    expect(describeChatFailure({ code: 'timeout', message: 'timed out' })).toMatchObject({
      code: 'timeout',
      retryable: false
    });
  });
});
