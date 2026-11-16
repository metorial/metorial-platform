# `@lowerdeck/joinPaths`

Join URL path segments and query parameters. Handles path normalization, null/undefined filtering, and automatic query string conversion.

## Installation

```bash
npm install @lowerdeck/joinPaths
yarn add @lowerdeck/joinPaths
bun add @lowerdeck/joinPaths
pnpm add @lowerdeck/joinPaths
```

## Usage

```typescript
import { joinPaths } from '@lowerdeck/joinPaths';

// Join path segments
joinPaths('/api', 'users', '123');
// '/api/users/123'

// Add query parameters
joinPaths('/api', 'users', { page: 1, limit: 10 });
// '/api/users?page=1&limit=10'

// Skip null/undefined values
joinPaths('/api', null, 'users', undefined, '123');
// '/api/users/123'

// Normalize paths
joinPaths('/api/', '/users/', '/123');
// '/api/users/123'

// Mix paths and query params
joinPaths('/api/users', { sort: 'name', order: 'asc' });
// '/api/users?sort=name&order=asc'
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
