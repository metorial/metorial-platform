# `@lowerdeck/service`

Wrap service methods with OpenTelemetry tracing. Automatically creates spans for each method call with error tracking and status reporting.

## Installation

```bash
npm install @lowerdeck/service
yarn add @lowerdeck/service
bun add @lowerdeck/service
pnpm add @lowerdeck/service
```

## Usage

```typescript
import { Service } from '@lowerdeck/service';

// Define your service
class UserService {
  async getUser(id: string) {
    // Your business logic
    return await database.users.findById(id);
  }

  async createUser(data: CreateUserData) {
    return await database.users.create(data);
  }

  async updateUser(id: string, data: UpdateUserData) {
    return await database.users.update(id, data);
  }
}

// Wrap with tracing
const userService = Service.create('user-service', () => new UserService())
  .build();

// All methods now have automatic tracing
await userService.getUser('123');
// Creates span: user-service.getUser

await userService.createUser({ name: 'John' });
// Creates span: user-service.createUser

// Errors are automatically tracked
try {
  await userService.getUser('invalid-id');
} catch (error) {
  // Span is marked with error status
}
```

### Benefits

- Automatic span creation for each method
- Error tracking with span status
- Method-level performance monitoring
- Zero boilerplate tracing code

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
