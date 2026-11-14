# `@lowerdeck/timezone`

Access a comprehensive timezone information database. Provides timezone names, codes, UTC offsets, and labels for all major timezones.

## Installation

```bash
npm install @lowerdeck/timezone
yarn add @lowerdeck/timezone
bun add @lowerdeck/timezone
pnpm add @lowerdeck/timezone
```

## Usage

```typescript
import { getTimezones, getTimezone, defaultTimezone } from '@lowerdeck/timezone';

// Get all timezones
const allTimezones = getTimezones();
console.log(allTimezones.length); // ~400+ timezones

// Get specific timezone by code or ID
const timezone = getTimezone('America/New_York');
console.log(timezone);
// {
//   label: '(GMT-05:00) Eastern Time',
//   tzCode: 'America/New_York',
//   name: 'Eastern Time',
//   utc: '-05:00',
//   id: 123,
//   utcOffsetInMinutes: -300
// }

// Get by numeric ID
const tz = getTimezone(123);

// Use default timezone
console.log(defaultTimezone);
// {
//   label: '(GMT+00:00) UTC',
//   tzCode: 'UTC',
//   ...
// }

// Build timezone selector
const timezoneOptions = getTimezones().map(tz => ({
  value: tz.tzCode,
  label: tz.label
}));
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
