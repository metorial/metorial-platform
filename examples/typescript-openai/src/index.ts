import { metorialOpenAI } from '@metorial/openai';
import { Metorial } from 'metorial';
import OpenAI from 'openai';

let metorial = new Metorial({ apiKey: '...your-metorial-api-key...' });
let openai = new OpenAI({ apiKey: '...your-openai-api-key...' });

metorial.withProviderSession(
  metorialOpenAI.chatCompletions,
  {
    serverDeployments: ['...server-deployment-id...']
  },
  async session => {
    // Message history for the chat completion
    let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'user',
        content:
          'Summarize the README.md file of the metorial/websocket-explorer repository on GitHub?'
      }
    ];

    for (let i = 0; i < 10; i++) {
      // Get next response from OpenAI
      let response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        tools: session.tools
      });
      let choice = response.choices[0]!;

      let toolCalls = choice.message.tool_calls;

      // No more tool calls -> we have the final response
      if (!toolCalls) {
        console.log(choice.message.content);
        return;
      }

      // Pass tool calls to Metorial
      let toolResponses = await session.callTools(toolCalls);

      // Save the tool call and tool responses to the message history
      messages.push(
        {
          role: 'assistant',
          tool_calls: choice.message.tool_calls
        },
        ...toolResponses
      );
    }

    throw new Error('No final response received after 10 iterations');
  }
);
