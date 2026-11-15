# `@lowerdeck/error`

Type-safe error handling with structured error objects. Create consistent error responses with status codes, error codes, messages, hints, and descriptions.

## Installation

```bash
npm install @lowerdeck/error
yarn add @lowerdeck/error
bun add @lowerdeck/error
pnpm add @lowerdeck/error
```

## Usage

```typescript
import { createError, ServiceError, isServiceError } from '@lowerdeck/error';

// Define error types
const Errors = {
  UserNotFound: new ServiceError(createError({
    statusCode: 404,
    errorCode: 'USER_NOT_FOUND',
    message: 'User not found',
    hint: 'The requested user does not exist',
    description: 'Check the user ID and try again'
  })),

  Unauthorized: new ServiceError(createError({
    statusCode: 401,
    errorCode: 'UNAUTHORIZED',
    message: 'Unauthorized',
    hint: 'You must be logged in to access this resource'
  }))
};

// Throw errors
function getUser(id: string) {
  const user = findUser(id);
  if (!user) {
    throw Errors.UserNotFound();
  }
  return user;
}

// Handle errors
try {
  const user = getUser('123');
} catch (error) {
  if (isServiceError(error)) {
    console.log(error.statusCode); // 404
    console.log(error.data.errorCode); // 'USER_NOT_FOUND'

    // Convert to HTTP response
    return error.toResponse();
  }
}
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
