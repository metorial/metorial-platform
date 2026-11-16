# `@lowerdeck/presenter`

Type-safe presentation layer for transforming domain objects into API responses. Supports multiple API versions, validation schemas, and context-aware transformations.

## Installation

```bash
npm install @lowerdeck/presenter
yarn add @lowerdeck/presenter
bun add @lowerdeck/presenter
pnpm add @lowerdeck/presenter
```

## Usage

```typescript
import { PresentableType, Presenter, declarePresenter } from '@lowerdeck/presenter';
import { v } from '@lowerdeck/validation';

// Define a presentable type
const UserType = PresentableType.create<{ id: string; name: string }>()('user');

// Create a presenter
const userPresenter = Presenter.create(UserType)
  .presenter(async (user, context) => ({
    object: 'user' as const,
    id: user.id,
    name: user.name,
    email: context.accessType === 'user_auth_token' ? 'hidden' : user.email
  }))
  .schema(v.object({
    object: v.literal('user'),
    id: v.string(),
    name: v.string()
  }))
  .build();

// Present data
const result = userPresenter.present(
  { id: '123', name: 'John' },
  { apiVersion: 'mt_2025_01_01_pulsar', accessType: 'user_auth_token' }
);

const data = await result.run({});
console.log(data); // { object: 'user', id: '123', name: 'John', ... }
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
