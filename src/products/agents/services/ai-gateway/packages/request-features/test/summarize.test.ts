import { describe, expect, it } from 'vitest';
import { lastUserText, summarizeRequest } from '../src';

describe('summarizeRequest: openai_chat', () => {
  it('reads turns, tools, parameters and attachments', () => {
    let summary = summarizeRequest('openai_chat', {
      model: 'smart',
      stream: true,
      max_completion_tokens: 2000,
      temperature: 0.2,
      reasoning_effort: 'high',
      response_format: { type: 'json_schema', json_schema: {} },
      tool_choice: 'required',
      tools: [{ type: 'function', function: { name: 'search', parameters: {} } }],
      messages: [
        { role: 'system', content: 'You are terse.' },
        { role: 'user', content: 'Find the bug' },
        {
          role: 'assistant',
          content: null,
          tool_calls: [{ id: '1', function: { name: 'search' } }]
        },
        { role: 'tool', tool_call_id: '1', content: 'result' },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Now look at this' },
            { type: 'image_url', image_url: { url: 'data:' } }
          ]
        }
      ]
    });

    expect(summary).toMatchObject({
      dialect: 'openai_chat',
      stream: true,
      messageCount: 5,
      userTurns: 2,
      isContinuation: false,
      hasImages: true,
      toolCount: 1,
      toolNames: ['search'],
      toolChoiceRequired: true,
      responseFormat: 'json_schema',
      maxOutputTokens: 2000,
      temperature: 0.2,
      reasoningEffort: 'high',
      systemText: 'You are terse.',
      userTexts: ['Find the bug', 'Now look at this']
    });
    expect(summary.estimatedInputTokens).toBeGreaterThan(0);
    expect(lastUserText(summary)).toBe('Now look at this');
  });

  it('marks a request ending in a tool result as a continuation', () => {
    let summary = summarizeRequest('openai_chat', {
      messages: [
        { role: 'user', content: 'Go' },
        { role: 'tool', tool_call_id: '1', content: 'done' }
      ]
    });

    expect(summary.isContinuation).toBe(true);
    expect(summary.userTexts).toEqual(['Go']);
  });

  it('tolerates malformed bodies', () => {
    let summary = summarizeRequest('openai_chat', { messages: 'nope', tools: 3 });

    expect(summary.messageCount).toBe(0);
    expect(summary.toolCount).toBe(0);
    expect(summarizeRequest('openai_chat', null).userTurns).toBe(0);
  });
});

describe('summarizeRequest: anthropic_messages', () => {
  it('separates human turns from tool results', () => {
    let summary = summarizeRequest('anthropic_messages', {
      system: [{ type: 'text', text: 'Be careful.' }],
      max_tokens: 1024,
      tool_choice: { type: 'any' },
      output_config: { effort: 'medium' },
      tools: [{ name: 'read_file', input_schema: {} }],
      messages: [
        { role: 'user', content: 'Refactor the parser' },
        {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 't', name: 'read_file', input: {} }]
        },
        {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 't', content: 'file contents' }]
        }
      ]
    });

    expect(summary).toMatchObject({
      dialect: 'anthropic_messages',
      messageCount: 3,
      userTurns: 1,
      isContinuation: true,
      toolNames: ['read_file'],
      toolChoiceRequired: true,
      maxOutputTokens: 1024,
      reasoningEffort: 'medium',
      systemText: 'Be careful.',
      userTexts: ['Refactor the parser']
    });
  });

  it('detects documents and images', () => {
    let summary = summarizeRequest('anthropic_messages', {
      messages: [
        {
          role: 'user',
          content: [
            { type: 'document', source: {} },
            { type: 'image', source: {} },
            { type: 'text', text: 'Summarize' }
          ]
        }
      ]
    });

    expect(summary.hasFiles).toBe(true);
    expect(summary.hasImages).toBe(true);
    expect(summary.isContinuation).toBe(false);
  });
});

describe('summarizeRequest: open_responses', () => {
  it('reads string input and instructions', () => {
    let summary = summarizeRequest('open_responses', {
      instructions: 'Answer in German.',
      input: 'What is CEL?',
      max_output_tokens: 300,
      reasoning: { effort: 'low' },
      text: { format: { type: 'json_object' } }
    });

    expect(summary).toMatchObject({
      dialect: 'open_responses',
      messageCount: 1,
      userTexts: ['What is CEL?'],
      systemText: 'Answer in German.',
      maxOutputTokens: 300,
      reasoningEffort: 'low',
      responseFormat: 'json_object'
    });
  });

  it('reads item input with function call outputs', () => {
    let summary = summarizeRequest('open_responses', {
      tools: [{ type: 'function', name: 'lookup' }, { type: 'web_search' }],
      input: [
        {
          role: 'user',
          content: [{ type: 'input_text', text: 'Look it up' }, { type: 'input_file' }]
        },
        { type: 'function_call', call_id: 'c', name: 'lookup', arguments: '{}' },
        { type: 'function_call_output', call_id: 'c', output: 'found' }
      ]
    });

    expect(summary.toolNames).toEqual(['lookup', 'web_search']);
    expect(summary.hasFiles).toBe(true);
    expect(summary.isContinuation).toBe(true);
    expect(summary.userTexts).toEqual(['Look it up']);
  });
});
