# `@lowerdeck/cache`

Multi-layer caching with Redis and in-memory LRU cache. Supports tag-based invalidation, dynamic TTL, and local-only caching for optimal performance.

## Installation

```bash
npm install @lowerdeck/cache
yarn add @lowerdeck/cache
bun add @lowerdeck/cache
pnpm add @lowerdeck/cache
```

## Usage

### Redis-backed cache

```typescript
import { createCachedFunction } from '@lowerdeck/cache';

const getUserProfile = createCachedFunction({
  name: 'user-profile',
  redisUrl: 'redis://localhost:6379',
  getHash: (userId: string) => userId,
  provider: async (userId, { setTTL }) => {
    const user = await database.getUser(userId);

    // Dynamically adjust TTL based on result
    if (user.isPremium) {
      setTTL(3600); // 1 hour for premium users
    }

    return user;
  },
  ttlSeconds: 300, // default 5 minutes
  getTags: (user, userId) => [`user:${userId}`, `role:${user.role}`]
});

// Fetch user (checks in-memory cache -> Redis -> provider)
const user = await getUserProfile('123');

// Clear specific user cache
await getUserProfile.clear('123');

// Clear all users with a specific role
await getUserProfile.clearByTag('role:admin');

// Wait for cache clear to complete
await getUserProfile.clearAndWait('123');
await getUserProfile.clearByTagAndWait('role:admin');
```

### Local-only cache

```typescript
import { createLocallyCachedFunction } from '@lowerdeck/cache';

const computeHash = createLocallyCachedFunction({
  getHash: (input: string) => input,
  provider: async (input) => {
    return expensiveHashComputation(input);
  },
  ttlSeconds: 60
});

// First call computes the result
const hash1 = await computeHash('data');

// Second call returns cached result
const hash2 = await computeHash('data');

// Clear cache for specific input
await computeHash.clear('data');
await computeHash.clearAndWait('data');
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
