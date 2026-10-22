// just-bash's ESM chunks declare `const require = createRequire(import.meta.url)`, which webpack/ncc
// rewrites into a self-referencing TDZ error at load time. `require` makes the bundler resolve the
// package's single-file CJS build instead.
export let { Bash } = require('just-bash') as typeof import('just-bash');

export type Bash = import('just-bash').Bash;
