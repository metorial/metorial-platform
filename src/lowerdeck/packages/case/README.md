# `@lowerdeck/case`

String case conversion utilities supporting multiple formats. Convert between camelCase, PascalCase, snake_case, kebab-case, and more.

## Installation

```bash
npm install @lowerdeck/case
yarn add @lowerdeck/case
bun add @lowerdeck/case
pnpm add @lowerdeck/case
```

## Usage

```typescript
import { Cases, capitalize } from '@lowerdeck/case';

// Different case conversions
Cases.toCamelCase('hello world');    // 'helloWorld'
Cases.toPascalCase('hello world');   // 'HelloWorld'
Cases.toKebabCase('hello world');    // 'hello-world'
Cases.toSnakeCase('hello world');    // 'hello_world'
Cases.toTitleCase('hello world');    // 'Hello World'
Cases.toSentenceCase('hello world'); // 'Hello world'

// Convenience function for title case
capitalize('hello world'); // 'Hello World'
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
