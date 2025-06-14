# Metorial + AI SDK (TypeScript) Example

This example demonstrates how to use the [Metorial SDK](https://www.npmjs.com/package/@metorial/sdk) alongside the [Vercel AI SDK](https://ai-sdk.dev/) and OpenAI. It shows how to enhance `generateText()` calls with Metorial-powered tools through the `@metorial/ai-sdk` integration.

> 🛠️ This setup allows OpenAI’s `gpt-4o` model to call your server-side tools automatically using Metorial.

## What's Included

- **@metorial/sdk** – Core Metorial SDK to register and manage tool sessions.
- **@metorial/ai-sdk** – Integration with the Vercel AI SDK’s tool calling system.
- **@ai-sdk/openai** – Vercel’s OpenAI integration using their streaming-friendly SDK.
- **Simple chat with tools** – An end-to-end example of prompting OpenAI with tool support and handling responses.

## Getting Started

### 1. Install Dependencies

```bash
bun install
````

> This project uses [Bun](https://bun.sh), but you can adapt it to Node or other environments if needed.

### 2. Configure API Keys

In your source file, replace the placeholders:

```ts
let metorial = new Metorial({ apiKey: '...your-metorial-api-key...' });
```

You’ll also need to specify a valid Metorial `serverDeploymentId`:

```ts
serverDeployments: ['...your-server-deployment-id...']
```

And ensure you have access to the OpenAI `gpt-4o` model via your OpenAI API key (handled by the Vercel SDK).

## Running the Example

```bash
bun start
```

This will:

1. Start a new `Metorial` provider session.
2. Use `generateText()` from the Vercel AI SDK with tool support.
3. Let OpenAI invoke your Metorial-deployed tools if needed.
4. Print the final output to the console.

## Example Code Walkthrough

```ts
metorial.withProviderSession(
  metorialAiSdk,
  { serverDeployments: ['...'] },
  async session => {
    let result = await generateText({
      model: openai('gpt-4o'),
      prompt: 'What is the capital of France?',
      maxSteps: 10,
      tools: session.tools
    });

    console.log(result.text);
  }
);
```

Here’s what happens:

* The Metorial session is initialized with tool bindings from `@metorial/ai-sdk`.
* `generateText()` runs a prompt with tool support enabled.
* If the model chooses to invoke a tool, Metorial handles the call and feeds the response back.
* The session continues until a final, tool-free answer is returned or `maxSteps` is reached.

> 🧠 This pattern allows AI models to reason through tasks by calling real tools, like APIs or internal services you've registered with Metorial.

## Requirements

* Bun (or Node-compatible runtime)
* OpenAI API access with GPT-4o
* A Metorial account and server deployment ID

## License

MIT — feel free to use, fork, or adapt this example in your own applications.

## Learn More

* [Metorial Documentation](https://metorial.com/docs)
* [Vercel AI SDK](https://ai-sdk.dev/)
* [OpenAI Tool Calling](https://platform.openai.com/docs/guides/tool-calling)
