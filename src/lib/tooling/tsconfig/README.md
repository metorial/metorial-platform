# `@lowerdeck/tsconfig`

Shared TypeScript configuration for the Lowerdeck monorepo. Provides a base tsconfig.json with common compiler options and settings.

## Installation

```bash
npm install @lowerdeck/tsconfig
yarn add @lowerdeck/tsconfig
bun add @lowerdeck/tsconfig
pnpm add @lowerdeck/tsconfig
```

## Usage

```json
{
  "extends": "@lowerdeck/tsconfig/base.json",
  "compilerOptions": {
    "outDir": "./dist"
  }
}
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
