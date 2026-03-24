# Slates

Slates is an integration platform for building, publishing, and running integration providers. Each provider (called a "slate") is a self-contained package published to a special registry. Slates are deployed as serverless functions and managed through a central hub.

## Features

- **Tools**: Callable actions with typed input/output schemas (defined with Zod). Each tool can carry instructions, constraints, and tags like `readOnly` or `destructive` to give consumers context about what it does.
- **Triggers**: Event sources that fire when something happens in an external service. Triggers support two modes: **polling** (periodic checks with state tracking) and **webhooks** (real-time HTTP callbacks with automatic registration/unregistration).
- **Authentication**: Built-in support for OAuth, token-based, service account, and custom authentication. A single slate can offer multiple auth methods. Auth outputs are typed and validated.
- **Configuration**: Typed configuration schemas with change handlers and defaults. Configuration is validated at runtime using Zod.
- **Registry**: A package registry for publishing and discovering slates. Slates are uploaded as versioned zip bundles containing a manifest (`slate.json`), code, and documentation. Supports scoped packages, sub-registries, and read-only access tokens.
- **Hub**: The orchestration layer that syncs slates from registries, deploys them to serverless functions, manages instances, handles sessions and tool calls, and runs trigger polling/webhook receivers.
- **Protocol**: Communication between the hub and slate providers uses JSON-RPC 2.0 with a defined lifecycle (hello, auth, config, session start, then productive calls).
- **Context Propagation**: Action handlers receive a `SlateContext` with access to config, auth, input, and logging. The context is also available anywhere in the call stack via `AsyncLocalStorage`.

## Writing a Slate

Install the `slates` package:

```bash
npm install slates zod
```

### 1. Define Config and Auth

```typescript
import { spec, config, auth, tool, trigger, Slate } from 'slates';
import z from 'zod';

let myConfig = config(z.object({
  baseUrl: z.string(),
}));

let myAuth = auth<{ token: string }>()
  .output(z.object({ token: z.string() }))
  .addTokenAuth({
    type: 'auth.token',
    key: 'api-key',
    name: 'API Key',
    inputSchema: z.object({ apiKey: z.string() }),
    getOutput: async ({ input }) => ({
      output: { token: input.apiKey },
    }),
  });
```

### 2. Create a Specification

The spec ties together the slate's identity, config, and auth:

```typescript
let mySpec = spec({
  key: 'my-service',
  name: 'My Service',
  description: 'Integrates with My Service',
  config: myConfig,
  auth: myAuth,
});
```

### 3. Define Tools

Tools are actions that can be invoked by consumers. Use the builder pattern to set input/output schemas and a handler:

```typescript
let listItems = tool(mySpec, {
  key: 'list-items',
  name: 'List Items',
  description: 'Returns all items',
  tags: { readOnly: true },
})
  .input(z.object({
    page: z.number().optional(),
  }))
  .output(z.object({
    items: z.array(z.object({ id: z.string(), name: z.string() })),
  }))
  .handleInvocation(async (ctx) => {
    let response = await fetch(`${ctx.config.baseUrl}/items?page=${ctx.input.page ?? 1}`, {
      headers: { Authorization: `Bearer ${ctx.auth.token}` },
    });
    let data = await response.json();

    return {
      output: { items: data.items },
      message: `Found ${data.items.length} items`,
    };
  })
  .build();
```

The `ctx` object gives you access to:

- `ctx.config` -- the validated configuration
- `ctx.auth` -- the authentication output
- `ctx.input` -- the validated input for this invocation
- `ctx.info()`, `ctx.warn()`, `ctx.error()`, `ctx.progress()` -- logging

### 4. Define Triggers

Triggers fire when events occur. A **polling trigger** periodically checks for new data:

```typescript
let onNewItem = trigger(mySpec, {
  key: 'on-new-item',
  name: 'On New Item',
  description: 'Fires when a new item is created',
})
  .input(z.object({ id: z.string(), name: z.string() }))
  .output(z.object({ type: z.string(), id: z.string(), name: z.string() }))
  .polling({
    options: { intervalInSeconds: 600 },
    pollEvents: async (ctx) => {
      let response = await fetch(`${ctx.config.baseUrl}/items?since=${ctx.state?.cursor ?? ''}`);
      let data = await response.json();

      return {
        inputs: data.items.map((item: any) => ({ id: item.id, name: item.name })),
        updatedState: { cursor: data.nextCursor },
      };
    },
    handleEvent: async (ctx) => ({
      type: 'item.created',
      id: ctx.input.id,
      output: { type: 'item.created', id: ctx.input.id, name: ctx.input.name },
    }),
  })
  .build();
```

A **webhook trigger** receives events in real time:

```typescript
let onItemUpdated = trigger(mySpec, {
  key: 'on-item-updated',
  name: 'On Item Updated',
  description: 'Fires when an item is updated',
})
  .input(z.object({ id: z.string(), name: z.string() }))
  .output(z.object({ type: z.string(), id: z.string(), name: z.string() }))
  .webhook({
    handleRequest: async (ctx) => {
      let body = await ctx.request.json();
      return {
        inputs: [{ id: body.id, name: body.name }],
      };
    },
    handleEvent: async (ctx) => ({
      type: 'item.updated',
      id: ctx.input.id,
      output: { type: 'item.updated', id: ctx.input.id, name: ctx.input.name },
    }),
    autoRegisterWebhook: async (ctx) => {
      // Register the webhook URL with the external service
      let result = await registerWebhook(ctx.input.webhookBaseUrl);
      return { registrationDetails: result };
    },
    autoUnregisterWebhook: async (ctx) => {
      await unregisterWebhook(ctx.input.registrationDetails);
    },
  })
  .build();
```

### 5. Assemble the Slate

```typescript
let slate = Slate.create({
  spec: mySpec,
  tools: [listItems],
  triggers: [onNewItem, onItemUpdated],
});

export default slate;
```

### Authentication Methods

The `auth()` builder supports multiple authentication strategies. You can add more than one to a single slate:

| Method | Builder | Use Case |
|--------|---------|----------|
| OAuth | `.addOauth({...})` | Full OAuth flow with authorization URL, callback, token refresh |
| Token | `.addTokenAuth({...})` | API keys, personal access tokens |
| Service Account | `.addServiceAccountAuth({...})` | Service-to-service credentials |
| Custom | `.addCustomAuth({...})` | Anything that doesn't fit the above |
| None | `.addNone()` | No authentication needed |

### Publishing

A slate is published as a zip archive containing:

- **`slate.json`** -- manifest with `name` (format: `@scope/identifier`), `version` (semver), `description`, and optional `categories`, `skills`, `logoUrl`
- **The compiled provider code**
- **`README.md`** and/or **`docs/*.md`** -- optional documentation

## Development

Prerequisites: Node >= 18, Bun >= 1.2.15

```bash
bun install
```

## License

This project is licensed under FSL-1.1-ALv2 (Functional Source License, converting to Apache 2.0).

<div align="center">
  <sub>Built by <a href="https://metorial.com">Metorial</a></sub>
</div>
