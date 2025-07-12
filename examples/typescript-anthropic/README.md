# Metorial + Anthropic (TypeScript) Example

This example shows how to use the [Metorial SDK](https://www.npmjs.com/package/metorial) with [Anthropic](https://www.npmjs.com/package/@anthropic-ai/sdk) in a TypeScript project. It demonstrates how to power Anthropic's `messages.create` with dynamic tool calling using Metorial’s `@metorial/anthropic` bindings.

> 🔧 This is a minimal, self-contained project to help you understand how Metorial can extend Anthropic workflows with custom tools.

## What's Included

- **Metorial SDK** — Core integration with `metorial` and the `@metorial/anthropic` helper for Anthropic-compatible tool interfaces.
- **Anthropic SDK** — For invoking `messages.create` with support for tool calling (`tool_use` blocks).
- **Example session loop** — A full example of how to iterate on tool-augmented completions until a final response is returned.

## Getting Started

### 1. Install Dependencies

This project uses [Bun](https://bun.sh). Install dependencies with:

```bash
bun install
```

### 2. Set Your API Keys

Replace placeholders in `index.ts`:

```ts
let metorial = new Metorial({ apiKey: '...your-metorial-api-key...' });
let anthropic = new Anthropic({ apiKey: '...your-anthropic-api-key...' });
```

You'll also need to provide a valid `serverDeploymentId` when initializing the session:

```ts
serverDeployments: ['...server-deployment-id...'];
```

### 3. Run the Example

```bash
bun start
```

This will:

1. Start a chat with Anthropic (using a Claude model).
2. Inject Metorial-compatible tools via the `@metorial/anthropic` integration.
3. Automatically call tools returned by Anthropic.
4. Iterate through the conversation until a final response is received.

## Code Walkthrough

The core logic is inside a `withProviderSession` call:

```ts
metorial.withProviderSession(
  metorialAnthropic,
  { serverDeployments: ['...server-deployment-id...'] },
  async session => {
    // Chat message history
    let messages: Anthropic.Messages.MessageParam[] = [
      { role: 'user', content: 'What is metorial.com about?' }
    ];

    for (let i = 0; i < 10; i++) {
      let response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages,
        tools: session.tools
      });

      // Extract any tool calls
      let toolCalls = response.content.filter(
        (c): c is Anthropic.Messages.ToolUseBlock => c.type === 'tool_use'
      );

      // No tool calls => final response
      if (toolCalls.length === 0) {
        let textContent = response.content
          .filter((c): c is Anthropic.Messages.TextBlock => c.type === 'text')
          .map(c => c.text)
          .join('');
        console.log(textContent);
        return;
      }

      // Call the tools via Metorial
      let toolResponses = await session.callTools(toolCalls);

      // Append the tool invocation and responses
      messages.push({ role: 'assistant', tool_calls: toolCalls }, ...toolResponses);
    }

    throw new Error('No final response received after 10 iterations');
  }
);
```

> 🧠 The loop lets Anthropic invoke any tools you've deployed via Metorial until the assistant can answer directly.

## Requirements

- [Bun](https://bun.sh) (v1.0+)
- Node-compatible environment
- Metorial account + deployment ID
- Anthropic API key (Claude access)

## License

MIT — feel free to use and adapt this code in your own projects.

## Learn More

- [Metorial Documentation](https://metorial.com/docs)
- [Metorial Anthropic Integration](https://www.npmjs.com/package/@metorial/anthropic)
- [Anthropic SDK](https://www.npmjs.com/package/@anthropic-ai/sdk)
