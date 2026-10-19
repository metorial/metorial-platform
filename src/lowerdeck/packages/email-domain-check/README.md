# `@lowerdeck/email-domain-check`

Check whether an email address can plausibly receive mail: syntax, caller-provided blocked domain suffixes, disposable email providers, and MX records.

The disposable domain list is the union of several public lists (wesbos/burner-email-providers, disposable/disposable-email-domains, ivolo/disposable-email-domains, andreis/disposable-email-domains, martenson/disposable-email-domains). It is loaded on first use, refreshed every 24 hours, and keeps the last good copy when a refresh fails. MX records are resolved through `dns.google`.

## Installation

```bash
npm install @lowerdeck/email-domain-check
yarn add @lowerdeck/email-domain-check
bun add @lowerdeck/email-domain-check
pnpm add @lowerdeck/email-domain-check
```

## Usage

```typescript
import {
  checkEmailDomain,
  disposableEmailDomains,
  hasMxRecords,
  matchesDomainSuffix
} from '@lowerdeck/email-domain-check';

await checkEmailDomain('jane@example.com', {
  blockedDomainSuffixes: ['internal.example.net']
});
// => { ok: true, email: 'jane@example.com', normalizedEmail: 'jane@example.com', domain: 'example.com' }

await checkEmailDomain('jane@mailinator.com');
// => { ok: false, reason: 'disposable' }

await disposableEmailDomains.isDisposable('x.mailinator.com');
// => true

await hasMxRecords('example.com');
// => true (throws MxLookupError when the lookup itself fails)

matchesDomainSuffix('a.internal.example.net', ['internal.example.net']);
// => true
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
