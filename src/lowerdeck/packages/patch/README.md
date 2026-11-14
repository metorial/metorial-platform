# `@lowerdeck/patch`

Small, idempotent, path-based patch operations for JSON values. Operations on different paths or
different array members merge cleanly, which makes them safe to apply optimistically on a client and
authoritatively on a server.

## Installation

```bash
npm install @lowerdeck/patch
yarn add @lowerdeck/patch
bun add @lowerdeck/patch
pnpm add @lowerdeck/patch
```

## Usage

```typescript
import { applyPatch } from '@lowerdeck/patch';

let next = applyPatch({ instances: {} }, [
  { op: 'add', path: ['instances', 'a'], value: 'skill_1' },
  { op: 'set', path: ['instances', 'b', 'label'], value: 'x' }
]);
```

| Operation | Behavior                                                                 |
| --------- | ------------------------------------------------------------------------ |
| `set`     | Sets the value at `path`, creating missing parent objects                |
| `unset`   | Deletes the key at `path`; a no-op when missing                          |
| `add`     | Appends to the array at `path` unless an equal member exists; creates it |
| `remove`  | Removes equal members from the array at `path`; a no-op when missing     |

Paths are arrays of object keys. Arrays are only changed through `add`, `remove`, or by `set`ting the
whole array. Applying an operation twice gives the same result as applying it once.
