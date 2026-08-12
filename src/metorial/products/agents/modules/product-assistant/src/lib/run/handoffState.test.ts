import { describe, expect, it } from 'vitest';
import { AgentRunState, applyHandoffToolResponses, getWaitingHandoffToolCalls } from './state';

let createWaitingState = () => {
  let runState = new AgentRunState();
  runState.pipe({
    type: 'tool.start',
    toolCallId: 'call_1',
    toolName: 'question',
    input: {
      question: 'What should we do?'
    },
    handoff: {
      title: 'Question',
      description: 'Ask the client a question'
    }
  });

  return runState.result().state;
};

describe('handoff state', () => {
  it('marks handoff tool calls as waiting for the client', () => {
    let state = createWaitingState();
    let waiting = getWaitingHandoffToolCalls(state);

    expect(waiting).toHaveLength(1);
    expect(waiting[0]?.toolName).toBe('question');
    expect(waiting[0]?.call).toMatchObject({
      id: 'call_1',
      status: 'waiting_for_user',
      handoff: {
        title: 'Question',
        description: 'Ask the client a question'
      }
    });
  });

  it('stores handoff responses and marks calls completed', () => {
    let result = applyHandoffToolResponses(createWaitingState(), [
      {
        toolCallId: 'call_1',
        output: {
          answer: 'Ship it'
        }
      }
    ]);

    expect(result.remaining).toHaveLength(0);
    expect(result.completed).toEqual([
      {
        toolCallId: 'call_1',
        toolName: 'question',
        output: {
          answer: 'Ship it'
        }
      }
    ]);
    expect(result.state.items[0]).toMatchObject({
      type: 'tool',
      calls: [
        {
          id: 'call_1',
          status: 'completed',
          output: {
            answer: 'Ship it'
          }
        }
      ]
    });
  });

  it('rejects unknown and duplicate handoff responses', () => {
    expect(() =>
      applyHandoffToolResponses(createWaitingState(), [
        {
          toolCallId: 'missing',
          output: {}
        }
      ])
    ).toThrow('No waiting handoff tool call found for missing');

    expect(() =>
      applyHandoffToolResponses(createWaitingState(), [
        {
          toolCallId: 'call_1',
          output: {}
        },
        {
          toolCallId: 'call_1',
          output: {}
        }
      ])
    ).toThrow('Duplicate handoff response for tool call call_1');
  });
});
