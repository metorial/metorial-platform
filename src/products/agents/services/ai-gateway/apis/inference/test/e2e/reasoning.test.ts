import type Anthropic from '@anthropic-ai/sdk';
import type { Dialect } from '@mtsrc/ai-gateway-dialects';
import type { Script } from '@mtsrc/ai-gateway-testing';
import type OpenAI from 'openai';
import { describe, expect, it } from 'vitest';
import { chatStreamTurn, model } from './clients';
import { createGateway, lastUpstreamBody, type Gateway } from './harness';

let weatherTool = {
  name: 'get_weather',
  description: 'Look up the weather',
  parameters: { type: 'object', properties: { city: { type: 'string' } } }
};

let anthropicTool: Anthropic.Tool = {
  name: weatherTool.name,
  description: weatherTool.description,
  input_schema: { type: 'object', properties: weatherTool.parameters.properties }
};

type ChatAssistant = OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam & {
  reasoning_details?: unknown;
};

// A client that keeps the conversation itself: it sends back exactly what it received,
// the way each API's documentation tells clients to.
type Conversation = {
  first: (gateway: Gateway, d: { stream: boolean; tools?: boolean }) => Promise<unknown>;
  second: (gateway: Gateway, turn: unknown, d: { toolResult?: string }) => Promise<unknown>;
  reasoningArtifact: (turn: unknown) => unknown;
};

let conversations: Record<Dialect, Conversation> = {
  anthropic_messages: {
    first: async (gateway, d) => {
      let request = {
        model,
        max_tokens: 4096,
        thinking: { type: 'enabled' as const, budget_tokens: 2048 },
        messages: [{ role: 'user' as const, content: 'Weather in Berlin?' }],
        ...(d.tools ? { tools: [anthropicTool] } : {})
      };

      return d.stream
        ? await gateway.anthropic.messages.stream(request).finalMessage()
        : await gateway.anthropic.messages.create(request);
    },
    second: async (gateway, turn, d) => {
      let message = turn as Anthropic.Message;
      let toolUse = message.content.find(block => block.type == 'tool_use');

      return await gateway.anthropic.messages.create({
        model,
        max_tokens: 4096,
        thinking: { type: 'enabled', budget_tokens: 2048 },
        ...(toolUse ? { tools: [anthropicTool] } : {}),
        messages: [
          { role: 'user', content: 'Weather in Berlin?' },
          { role: 'assistant', content: message.content },
          {
            role: 'user',
            content:
              toolUse && d.toolResult
                ? [{ type: 'tool_result', tool_use_id: toolUse.id, content: d.toolResult }]
                : 'And tomorrow?'
          }
        ]
      });
    },
    reasoningArtifact: turn =>
      (turn as Anthropic.Message).content.flatMap(block =>
        block.type == 'thinking'
          ? [block.signature]
          : block.type == 'redacted_thinking'
            ? [block.data]
            : []
      )[0]
  },

  openai_chat: {
    first: async (gateway, d) => {
      let request = {
        model,
        reasoning_effort: 'medium' as const,
        messages: [{ role: 'user' as const, content: 'Weather in Berlin?' }],
        ...(d.tools ? { tools: [{ type: 'function' as const, function: weatherTool }] } : {})
      };

      if (!d.stream)
        return (await gateway.openai.chat.completions.create(request)).choices[0]!.message;

      // A streaming client rebuilds the message, including the reasoning details sent at the end
      // of each reasoning block.
      let turn = await chatStreamTurn(
        await gateway.openai.chat.completions.create({ ...request, stream: true })
      );
      let details = turn.chunks.flatMap(chunk => {
        let delta = chunk.choices[0]?.delta as { reasoning_details?: unknown[] } | undefined;
        return delta?.reasoning_details ?? [];
      });

      return {
        role: 'assistant',
        content: turn.text || null,
        reasoning_content: turn.reasoning,
        reasoning_details: details,
        ...(turn.toolCalls.length
          ? {
              tool_calls: turn.toolCalls.map(call => ({
                id: call.id,
                type: 'function',
                function: { name: call.name, arguments: JSON.stringify(call.args) }
              }))
            }
          : {})
      };
    },
    second: async (gateway, turn, d) => {
      let message = turn as ChatAssistant & { tool_calls?: { id: string }[] };
      let toolCall = message.tool_calls?.[0];

      return await gateway.openai.chat.completions.create({
        model,
        reasoning_effort: 'medium',
        ...(toolCall ? { tools: [{ type: 'function', function: weatherTool }] } : {}),
        messages: [
          { role: 'user', content: 'Weather in Berlin?' },
          message as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam,
          toolCall && d.toolResult
            ? { role: 'tool', tool_call_id: toolCall.id, content: d.toolResult }
            : { role: 'user', content: 'And tomorrow?' }
        ]
      });
    },
    reasoningArtifact: turn => (turn as ChatAssistant).reasoning_details
  },

  open_responses: {
    first: async (gateway, d) => {
      let request = {
        model,
        reasoning: { effort: 'medium' as const, summary: 'auto' as const },
        include: ['reasoning.encrypted_content' as const],
        store: false,
        input: 'Weather in Berlin?',
        ...(d.tools
          ? { tools: [{ type: 'function' as const, ...weatherTool, strict: null }] }
          : {})
      };

      return d.stream
        ? await gateway.openai.responses.stream(request).finalResponse()
        : await gateway.openai.responses.create(request);
    },
    second: async (gateway, turn, d) => {
      let response = turn as OpenAI.Responses.Response;
      let call = response.output.find(item => item.type == 'function_call');

      return await gateway.openai.responses.create({
        model,
        reasoning: { effort: 'medium', summary: 'auto' },
        include: ['reasoning.encrypted_content'],
        store: false,
        ...(call ? { tools: [{ type: 'function', ...weatherTool, strict: null }] } : {}),
        input: [
          { role: 'user', content: 'Weather in Berlin?' },
          ...(response.output as OpenAI.Responses.ResponseInputItem[]),
          call && d.toolResult
            ? { type: 'function_call_output', call_id: call.call_id, output: d.toolResult }
            : { role: 'user', content: 'And tomorrow?' }
        ]
      });
    },
    reasoningArtifact: turn =>
      (turn as OpenAI.Responses.Response).output.flatMap(item =>
        item.type == 'reasoning' ? [item.encrypted_content] : []
      )[0]
  }
};

let dialects = Object.keys(conversations) as Dialect[];

let thinkingScript: Script = {
  steps: [
    { type: 'reasoning', text: 'The user wants the weather.', signature: 'sig_native_123' },
    { type: 'text', text: 'It is sunny.' }
  ]
};

let toolScript: Script = {
  steps: [
    { type: 'reasoning', text: 'I should call the tool.', signature: 'sig_tool_456' },
    { type: 'tool-call', id: 'toolu_1', name: 'get_weather', input: { city: 'Berlin' } }
  ]
};

let roundTrip = async (d: {
  provider: string;
  dialect: Dialect;
  script: Script;
  stream: boolean;
  tools?: boolean;
  toolResult?: string;
}) => {
  let gateway = createGateway({
    providers: [d.provider],
    upstream: request =>
      gateway.upstream.requests.filter(entry => entry.wire != 'anthropic-count-tokens')
        .length == 1
        ? d.script
        : { steps: [{ type: 'text', text: 'Done.' }] }
  });
  let conversation = conversations[d.dialect];

  let first = await conversation.first(gateway, { stream: d.stream, tools: d.tools });
  await conversation.second(gateway, first, { toolResult: d.toolResult });

  return {
    gateway,
    first,
    upstream: lastUpstreamBody(gateway),
    artifact: conversation.reasoningArtifact(first)
  };
};

let anthropicThinking = (body: any) =>
  body.messages.flatMap((message: any) =>
    message.role == 'assistant'
      ? message.content.filter(
          (block: any) => block.type == 'thinking' || block.type == 'redacted_thinking'
        )
      : []
  );

let openaiReasoningItems = (body: any) =>
  body.input.filter((item: any) => item.type == 'reasoning');

let googleThoughts = (body: any) =>
  body.contents.flatMap((content: any) =>
    content.role == 'model'
      ? content.parts.filter((part: any) => part.thought || part.thoughtSignature)
      : []
  );

describe('reasoning survives a stateless round trip', () => {
  for (let dialect of dialects) {
    for (let stream of [false, true]) {
      let mode = stream ? 'streamed' : 'buffered';

      it(`sends Anthropic its thinking signature back through ${dialect} (${mode})`, async () => {
        let { upstream, artifact } = await roundTrip({
          provider: 'anthropic',
          dialect,
          script: thinkingScript,
          stream
        });

        expect(artifact).toBeTruthy();
        expect(anthropicThinking(upstream)).toEqual([
          {
            type: 'thinking',
            thinking: 'The user wants the weather.',
            signature: 'sig_native_123'
          }
        ]);
      });

      it(`sends OpenAI its encrypted reasoning back through ${dialect} (${mode})`, async () => {
        let { upstream, artifact } = await roundTrip({
          provider: 'openai',
          dialect,
          script: thinkingScript,
          stream
        });

        expect(artifact).toBeTruthy();
        expect(openaiReasoningItems(upstream)).toEqual([
          expect.objectContaining({
            type: 'reasoning',
            encrypted_content: 'sig_native_123',
            summary: [{ type: 'summary_text', text: 'The user wants the weather.' }]
          })
        ]);
      });

      it(`sends Google its thought signature back through ${dialect} (${mode})`, async () => {
        let { upstream } = await roundTrip({
          provider: 'google-ai-studio',
          dialect,
          script: thinkingScript,
          stream
        });

        expect(googleThoughts(upstream)).toEqual([
          expect.objectContaining({
            text: 'The user wants the weather.',
            thought: true,
            thoughtSignature: 'sig_native_123'
          })
        ]);
      });

      it(`keeps Anthropic thinking ahead of a tool call through ${dialect} (${mode})`, async () => {
        let { upstream } = await roundTrip({
          provider: 'anthropic',
          dialect,
          script: toolScript,
          stream,
          tools: true,
          toolResult: 'Sunny, 21C'
        });

        let assistant = upstream.messages.find((message: any) => message.role == 'assistant');
        expect(assistant.content).toEqual([
          { type: 'thinking', thinking: 'I should call the tool.', signature: 'sig_tool_456' },
          { type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: { city: 'Berlin' } }
        ]);
        expect(upstream.messages.at(-1).content).toEqual([
          { type: 'tool_result', tool_use_id: 'toolu_1', content: 'Sunny, 21C' }
        ]);
      });

      it(`returns redacted Anthropic thinking intact through ${dialect} (${mode})`, async () => {
        let { upstream } = await roundTrip({
          provider: 'anthropic',
          dialect,
          script: {
            steps: [
              { type: 'reasoning', text: '', redacted: 'opaque_redacted_payload' },
              { type: 'text', text: 'Answer.' }
            ]
          },
          stream
        });

        expect(anthropicThinking(upstream)).toEqual([
          { type: 'redacted_thinking', data: 'opaque_redacted_payload' }
        ]);
      });
    }
  }
});

describe('native reasoning artifacts', () => {
  it('hands Anthropic clients the real Anthropic signature', async () => {
    let { artifact } = await roundTrip({
      provider: 'anthropic',
      dialect: 'anthropic_messages',
      script: thinkingScript,
      stream: false
    });

    expect(artifact).toBe('sig_native_123');
  });

  it('hands Open Responses clients the real OpenAI encrypted content and item id', async () => {
    let { first } = await roundTrip({
      provider: 'openai',
      dialect: 'open_responses',
      script: thinkingScript,
      stream: false
    });

    let reasoning = (first as OpenAI.Responses.Response).output.find(
      item => item.type == 'reasoning'
    );
    expect(reasoning).toMatchObject({ id: 'rs_0', encrypted_content: 'sig_native_123' });
  });

  it('wraps foreign reasoning state in an opaque envelope', async () => {
    let { artifact } = await roundTrip({
      provider: 'openai',
      dialect: 'anthropic_messages',
      script: thinkingScript,
      stream: false
    });

    expect(artifact).toMatch(/^mgw1\./);
  });
});

describe('switching providers mid-conversation', () => {
  it('does not send one provider’s reasoning state to another', async () => {
    let first = createGateway({ providers: ['anthropic'], upstream: thinkingScript });
    let turn = await conversations.anthropic_messages.first(first, { stream: false });

    let second = createGateway({
      providers: ['openai'],
      upstream: { steps: [{ type: 'text', text: 'ok' }] }
    });
    await conversations.anthropic_messages.second(second, turn, {});

    let body = lastUpstreamBody(second);
    expect(JSON.stringify(body)).not.toContain('sig_native_123');
    expect(second.logs[0]!.log.status).toBe('succeeded');
  });
});
