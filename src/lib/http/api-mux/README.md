# `@lowerdeck/api-mux`

Route multiplexer for API endpoints. Dispatches requests to different services based on domain, path, and HTTP method with support for fallback handlers.

## Installation

```bash
npm install @lowerdeck/api-mux
yarn add @lowerdeck/api-mux
bun add @lowerdeck/api-mux
pnpm add @lowerdeck/api-mux
```

## Usage

```typescript
import { apiMux } from '@lowerdeck/api-mux';

// Define your services
const mux = apiMux([
  {
    domains: ['api.example.com'],
    methods: ['GET', 'POST'],
    endpoint: {
      path: '/users',
      fetch: async (req) => {
        return new Response('Users API');
      }
    }
  },
  {
    methods: ['POST'],
    endpoint: {
      path: '/webhooks',
      exact: true, // Only match exact path
      fetch: async (req) => {
        return new Response('Webhook handler');
      }
    }
  }
], async (req, server) => {
  // Fallback handler for unmatched routes
  return new Response('Not found', { status: 404 });
});

// Use with your HTTP server
const server = Bun.serve({
  fetch: mux
});
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
