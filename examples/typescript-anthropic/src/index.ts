import { metorialAnthropic } from '@metorial/anthropic';
import { Metorial } from 'metorial';
import Anthropic from '@anthropic-ai/sdk';

let metorial = new Metorial({
  apiKey: '...your-metorial-api-key...'
});

let anthropic = new Anthropic({
  apiKey: '...your-anthropic-api-key...'
});

metorial.withProviderSession(
  metorialAnthropic,
  {
    serverDeployments: ['...server-deployment-id...']
  },
  async session => {
    // Message history for the chat completion
    let messages: Anthropic.Messages.MessageParam[] = [
      {
        role: 'user',
        content: 'What is metorial.com about? '
      }
    ];

    console.log(session.tools);

    for (let i = 0; i < 10; i++) {
      // Get next response from Anthropic
      let response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages,
        tools: session.tools
      });

      let toolCalls = getToolUseBlocks(response.content);

      // No more tool calls -> we have the final response
      if (toolCalls.length === 0) {
        let textContent = getTextContent(response.content);
        console.log(textContent);
        return;
      }

      // Pass tool calls to Metorial
      let toolResponses = await session.callTools(toolCalls);

      // Save the tool call and tool responses to the message history
      messages.push(
        {
          role: 'assistant',
          content: response.content
        },
        toolResponses
      );
    }

    throw new Error('No final response received after 10 iterations');
  }
);

// Helper utilities for cleaner content filtering
const getToolUseBlocks = (
  content: Anthropic.Messages.ContentBlock[]
): Anthropic.Messages.ToolUseBlock[] =>
  content.filter((c): c is Anthropic.Messages.ToolUseBlock => c.type === 'tool_use');

const getTextContent = (content: Anthropic.Messages.ContentBlock[]): string =>
  content
    .filter((c): c is Anthropic.Messages.TextBlock => c.type === 'text')
    .map(c => c.text)
    .join('');
