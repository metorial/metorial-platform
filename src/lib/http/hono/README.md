# `@lowerdeck/hono`

Create Hono web applications with Metorial defaults. Includes error handling for ServiceError, 404 handling, and CORS configuration.

## Installation

```bash
npm install @lowerdeck/hono
yarn add @lowerdeck/hono
bun add @lowerdeck/hono
pnpm add @lowerdeck/hono
```

## Usage

```typescript
import { createHono, cors } from '@lowerdeck/hono';

// Create Hono app with defaults
const app = createHono('/api');

// Routes
app.get('/users/:id', async (c) => {
  const id = c.req.param('id');
  const user = await getUser(id);
  return c.json(user);
});

// ServiceError handling is automatic
import { createError } from '@lowerdeck/error';

const UserNotFound = createError({
  statusCode: 404,
  errorCode: 'USER_NOT_FOUND',
  message: 'User not found'
});

app.get('/users/:id', async (c) => {
  const user = await getUser(id);
  if (!user) {
    throw UserNotFound(); // Automatically handled
  }
  return c.json(user);
});

// Custom CORS configuration
app.use('/api/*', cors({
  origin: 'https://example.com',
  credentials: true
}));

export default app;
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
