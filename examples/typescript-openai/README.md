# Metorial + OpenAI (TypeScript) Example

This example shows how to use the [Metorial SDK](https://www.npmjs.com/package/metorial) with [OpenAI](https://www.npmjs.com/package/openai) in a TypeScript project. It demonstrates how to power OpenAI's `chat.completions` with dynamic tool calling using Metorial’s `@metorial/openai` bindings.

> 🔧 This is a minimal, self-contained project to help you understand how Metorial can extend OpenAI workflows with custom tools.

## What's Included

- **Metorial SDK** — Core integration with `metorial` and the `@metorial/openai` helper for OpenAI-compatible tool interfaces.
- **OpenAI SDK** — For invoking `chat.completions` with support for tool calling (`tool_calls`).
- **Example session loop** — A full example of how to iterate on tool-augmented completions until a final response is returned.

## Getting Started

### 1. Install Dependencies

This project uses [Bun](https://bun.sh). Install dependencies with:

```bash
bun install
````

### 2. Set Your API Keys

Replace placeholders in `index.ts`:

```ts
let metorial = new Metorial({ apiKey: '...your-metorial-api-key...' });
let openai = new OpenAI({ apiKey: '...your-openai-api-key...' });
```

You'll also need to provide a valid `serverDeploymentId` when initializing the session:

```ts
serverDeployments: ['...server-deployment-id...']
```

### 3. Run the Example

```bash
bun start
```

This will:

1. Start a chat with OpenAI (using GPT-4o).
2. Inject Metorial-compatible tools via the `@metorial/openai` integration.
3. Automatically call tools returned by OpenAI.
4. Iterate through the conversation until a final response is received.

## Code Walkthrough

The core logic is inside a `withProviderSession` call:

```ts
metorial.withProviderSession(
  metorialOpenAI.chatCompletions,
  { serverDeployments: ['...'] },
  async session => {
    // Chat message history
    let messages = [{ role: 'user', content: '...' }];

    for (let i = 0; i < 10; i++) {
      let response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        tools: session.tools
      });

      let choice = response.choices[0];
      let toolCalls = choice.message.tool_calls;

      if (!toolCalls) {
        console.log(choice.message.content);
        return;
      }

      let toolResponses = await session.callTools(toolCalls);

      messages.push(
        { role: 'assistant', tool_calls: toolCalls },
        ...toolResponses
      );
    }

    throw new Error('No final response received after 10 iterations');
  }
);
```

> 🧠 The tool loop allows OpenAI to use tools you've deployed via Metorial until it arrives at a final response.

## Requirements

* [Bun](https://bun.sh) (v1.0+)
* Node-compatible environment
* Metorial account + deployment ID
* OpenAI API key with GPT-4o access

## License

MIT — feel free to use and adapt this code in your own projects.

## Learn More

* [Metorial Documentation](https://metorial.com/docs)
* [OpenAI Tool Calling](https://platform.openai.com/docs/guides/tool-calling)
* [OpenAI SDK](https://www.npmjs.com/package/openai)
