# `@metorial-platform-systems/origin-client`

TypeScript RPC client for the Origin service (`oss/src/systems/origin`). Used by Subspace and other platform code.

```ts
import { createOriginClient } from '@metorial-platform-systems/origin-client';

let origin = createOriginClient({
  endpoint: 'https://example.com/metorial-origin'
});
```

## License

Apache License 2.0
