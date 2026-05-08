import { SessionEvent } from '@openharness/core';
import { describe, expect, it } from 'vitest';
import { JsonValue, createClientReplica } from '../src/lib/delta';
import { AgentRunState, AgentRunWireMessage } from '../src/lib/run/state';

let event = (event: Partial<SessionEvent> & { type: string }) => event as SessionEvent;

describe('AgentRunState delta integration', () => {
  it('emits one delta batch per streamed event and keeps the final state snapshot', () => {
    let messages: AgentRunWireMessage[] = [];
    let runState = new AgentRunState([], {
      onWireMessage: message => messages.push(message)
    });

    runState.pipe(event({ type: 'text.delta', text: 'hello' }));
    runState.pipe(event({ type: 'text.delta', text: ' world' }));
    runState.pipe(event({ type: 'text.done', text: 'hello world' }));

    expect(messages).toHaveLength(3);
    expect(messages.map(message => message[0])).toEqual([1, 2, 3]);
    expect(runState.version).toBe(3);
    expect(runState.result().state).toEqual({
      items: [
        {
          id: 'message:0',
          type: 'message',
          status: 'completed',
          message: {
            role: 'assistant',
            parts: [{ type: 'text', text: 'hello world' }]
          }
        }
      ]
    });
  });

  it('includes the first streamed text chunk in the first emitted delta batch', () => {
    let messages: AgentRunWireMessage[] = [];
    let runState = new AgentRunState([], {
      onWireMessage: message => messages.push(message)
    });

    runState.pipe(event({ type: 'text.delta', text: 'Tr' }));
    runState.pipe(event({ type: 'text.delta', text: 'ains' }));

    expect(messages).toEqual([
      [
        1,
        [
          2,
          ['items'],
          0,
          [
            {
              id: 'message:0',
              type: 'message',
              status: 'running',
              message: {
                role: 'assistant',
                parts: [{ type: 'text', text: 'Tr' }]
              }
            }
          ]
        ]
      ],
      [2, [5, ['items', '0', 'message', 'parts', '0', 'text'], 'ains']]
    ]);
    expect(runState.result().state).toEqual({
      items: [
        {
          id: 'message:0',
          type: 'message',
          status: 'running',
          message: {
            role: 'assistant',
            parts: [{ type: 'text', text: 'Trains' }]
          }
        }
      ]
    });
  });

  it('emits deltas that a client replica can apply', () => {
    let replica = createClientReplica<JsonValue>({
      initial: { items: [] }
    });
    let runState = new AgentRunState([], {
      onWireMessage: message => replica.receive(message)
    });

    runState.pipe(
      event({
        type: 'tool.start',
        toolName: 'bash',
        toolCallId: 'tool-1',
        input: { command: 'echo hello' }
      })
    );
    runState.pipe(
      event({
        type: 'tool.done',
        toolName: 'bash',
        toolCallId: 'tool-1',
        output: { stdout: 'hello\n', stderr: '', exitCode: 0 }
      })
    );

    expect(replica.getIndex()).toBe(runState.version);
    expect(replica.getState()).toEqual(runState.result().state);
  });

  it('stores web search calls as native web state items', () => {
    let runState = new AgentRunState([], {});

    runState.pipe(
      event({
        type: 'tool.start',
        toolName: 'webSearch',
        toolCallId: 'tool-web-1',
        input: { query: 'test', country: 'us', type: 'web' }
      })
    );
    runState.pipe(
      event({
        type: 'tool.done',
        toolName: 'webSearch',
        toolCallId: 'tool-web-1',
        output: [
          {
            title: 'Example result',
            url: 'https://example.com',
            description: 'Example description'
          }
        ]
      })
    );

    expect(runState.result().state).toEqual({
      items: [
        {
          id: 'web',
          type: 'web',
          operations: [
            {
              id: 'tool-web-1',
              type: 'search',
              query: 'test',
              country: 'us',
              searchType: 'web',
              input: { query: 'test', country: 'us', type: 'web' },
              output: [
                {
                  title: 'Example result',
                  url: 'https://example.com',
                  description: 'Example description'
                }
              ],
              results: [
                {
                  title: 'Example result',
                  url: 'https://example.com',
                  description: 'Example description'
                }
              ],
              status: 'completed'
            }
          ]
        }
      ]
    });
  });

  it('can emit tagged delta messages for transports that include message type', () => {
    let messages: AgentRunWireMessage[] = [];
    let runState = new AgentRunState([], {
      deltaFormat: 'message',
      onWireMessage: message => messages.push(message)
    });

    runState.pipe(event({ type: 'reasoning.delta', text: 'thinking' }));

    expect(messages[0]?.[0]).toBe('d');
  });

  it('includes snapshot index and usage metadata in the final result', () => {
    let runState = new AgentRunState([], {});

    runState.pipe(event({ type: 'text.delta', text: 'hello' }));
    runState.pipe(
      event({
        type: 'step.done',
        usage: {
          inputTokens: 10,
          outputTokens: 5,
          totalTokens: 15
        }
      })
    );

    let result = runState.result();

    expect(result.snapshotIndex).toBe(runState.version);
    expect(result.usage).toEqual({
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15
    });
    expect(result.metadata.usage).toEqual(result.usage);
  });
});
