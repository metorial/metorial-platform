# `@lowerdeck/normalize-email`

Normalize email addresses to their canonical form. Handles Gmail dots, plus-addressing, and domain variations to prevent duplicate accounts.

## Installation

```bash
npm install @lowerdeck/normalize-email
yarn add @lowerdeck/normalize-email
bun add @lowerdeck/normalize-email
pnpm add @lowerdeck/normalize-email
```

## Usage

```typescript
import { normalizeEmail } from '@lowerdeck/normalize-email';

// Remove dots in Gmail addresses
normalizeEmail('john.doe@gmail.com');
// => 'johndoe@gmail.com'

// Remove plus-addressing
normalizeEmail('user+tag@example.com');
// => 'user@example.com'

// Handle googlemail.com -> gmail.com
normalizeEmail('user@googlemail.com');
// => 'user@gmail.com'

// Combine all normalization rules
normalizeEmail('John.Doe+newsletter@GmailMail.com');
// => 'johndoe@gmail.com'

// Prevent duplicate accounts
const users = new Map();
function registerUser(email: string) {
  const normalized = normalizeEmail(email);

  if (users.has(normalized)) {
    throw new Error('Account already exists');
  }

  users.set(normalized, { email });
}
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
