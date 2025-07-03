import { openai } from '@ai-sdk/openai';
import { metorialAiSdk } from '@metorial/ai-sdk';
import { Metorial } from '@metorial/sdk';
import { generateText } from 'ai';

let metorial = new Metorial({ apiKey: '...your-metorial-api-key...' });

metorial.withProviderSession(
  metorialAiSdk,
  {
    serverDeployments: ['...server-deployment-id...']
  },
  async session => {
    let result = await generateText({
      model: openai('gpt-4o'),
      prompt:
        'Summarize the README.md file of the metorial/websocket-explorer repository on GitHub?',
      maxSteps: 10,
      tools: session.tools
    });

    console.log(result.text);
  }
);
