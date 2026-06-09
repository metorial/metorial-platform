# `@lowerdeck/pagination`

Cursor-based pagination utilities with support for Prisma and custom data providers. Provides type-safe pagination with configurable limits and ordering.

## Installation

```bash
npm install @lowerdeck/pagination
yarn add @lowerdeck/pagination
bun add @lowerdeck/pagination
pnpm add @lowerdeck/pagination
```

## Usage

```typescript
import { Paginator } from '@lowerdeck/pagination';

// Create a paginator with a data provider
const usersPaginator = Paginator.create(
  ({ prisma }) => prisma.user.findMany,
  {
    defaultLimit: 20,
    defaultOrder: 'asc'
  }
);

// Fetch paginated results
const page1 = await usersPaginator.run({
  limit: 10,
  order: 'asc'
});

// Navigate using cursors
const page2 = await usersPaginator.run({
  limit: 10,
  after: page1.items[page1.items.length - 1].id
});

console.log(page2.pagination.hasNextPage); // true/false
console.log(page2.pagination.hasPreviousPage); // true/false

// Present paginated data
const presented = await Paginator.presentLight(page1, (user) => ({
  id: user.id,
  name: user.name
}));

console.log(presented); // { object: 'list', items: [...], pagination: {...} }
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
