# `@lowerdeck/cors`

Shared CORS origin helpers. In development (`NODE_ENV=development`), every `localhost`, `127.0.0.1`, `[::1]` and `*.localhost` origin is allowed by all CORS checks.

## Usage

```typescript
import { isLocalDevelopmentOrigin } from '@lowerdeck/cors';

let corsOk = isLocalDevelopmentOrigin(origin) || isAllowedInProduction(origin);
```
