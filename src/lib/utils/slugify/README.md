# `@lowerdeck/slugify`

Generate URL-friendly slugs with collision detection. Automatically handles uniqueness and provides short ID generation with random padding.

## Installation

```bash
npm install @lowerdeck/slugify
yarn add @lowerdeck/slugify
bun add @lowerdeck/slugify
pnpm add @lowerdeck/slugify
```

## Usage

### Basic Slugify

```typescript
import { slugify } from '@lowerdeck/slugify';

// Convert to URL-safe slug
slugify('Hello World!');  // 'hello-world'
slugify('This & That');   // 'this-that'
slugify('Café ☕');       // 'cafe'
```

### Slug Generator with Collision Detection

```typescript
import { createSlugGenerator } from '@lowerdeck/slugify';

// Create generator with collision checker
const generateSlug = createSlugGenerator(async (slug) => {
  // Check if slug exists in database
  return await db.posts.exists({ slug });
});

// Generate unique slug
const slug1 = await generateSlug('My Post');        // 'my-post'
const slug2 = await generateSlug('My Post');        // 'my-post-abc123'
const slug3 = await generateSlug('My Post');        // 'my-post-xyz789'
```

### Short ID Generator

```typescript
import { createShortIdGenerator } from '@lowerdeck/slugify';

// Create short ID generator
const generateShortId = createShortIdGenerator(
  async (id) => await db.links.exists({ id }),
  { minLength: 6 }
);

// Generate short IDs with collision avoidance
const id1 = await generateShortId('product'); // 'produc'
const id2 = await generateShortId('prod');    // 'prod12' (padded to min length)
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
