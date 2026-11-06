let esmHelper =
  /var __esm = \((\w+), (\w+), (\w+)\) => function\(\) \{\s*if \(\3\) throw \3\[0\];\s*try \{\s*return \1 && \(\2 = \(0, \1\[__getOwnPropNames\(\1\)\[0\]\]\)\(\1 = 0\)\), \2;\s*\} catch \((\w+)\) \{\s*throw \3 = \[\4\], \4;\s*\}\s*\};/;

// esbuild wraps modules that cannot be hoisted (dynamic imports, top-level await) in a lazy
// initializer. When an async initializer is re-entered through an import cycle it hands back its
// own pending promise, so modules end up awaiting each other and the process hangs silently.
// Native ESM skips a module that is already being evaluated; the replacement helper does the same
// by tracking which module waits on which and skipping any wait that would close a cycle. This
// also covers cycles entered from two concurrent import chains, which a per-chain check misses.
// The replacement stays on one line (padded) so source maps stay aligned.
let cycleSafeEsmHelper = (fn: string, res: string, err: string, e: string) =>
  [
    `var __esmCur = new (require("node:async_hooks").AsyncLocalStorage)(); var __esmWaits = new Map();`,
    `var __esmReaches = (from, to) => { let seen = new Set(), stack = [from]; while (stack.length) { let m = stack.pop(); if (m === to) return true; if (seen.has(m)) continue; seen.add(m); let out = __esmWaits.get(m); if (out) for (let n of out) stack.push(n); } return false; };`,
    `var __esmWait = (cur, self) => { let set = __esmWaits.get(cur); set || __esmWaits.set(cur, set = new Set()); set.add(self); };`,
    `var __esm = (${fn}, ${res}, ${err}, self, pending) => (self = function() {`,
    `if (${err}) throw ${err}[0];`,
    `let cur = __esmCur.getStore();`,
    `if (cur === self) { if (!${fn}) return; }`,
    `else if (cur && pending) { if (__esmReaches(self, cur)) return; __esmWait(cur, self); }`,
    `if (!${fn}) return ${res};`,
    `let done = () => (pending = 0, __esmWaits.delete(self));`,
    `try { let init = ${fn}[__getOwnPropNames(${fn})[0]]; ${fn} = 0; pending = 1; if (cur && cur !== self) __esmWait(cur, self); ${res} = __esmCur.run(self, () => init(0)); if (${res} && ${res}.then) ${res}.then(done, done); else done(); return ${res}; }`,
    `catch (${e}) { done(); throw ${err} = [${e}], ${e}; }`,
    `});`
  ].join(' ');

export let makeEsmCyclesSafe = (code: string, fileName: string) => {
  if (!code.includes('var __esm =')) return code;

  let match = esmHelper.exec(code);
  if (!match) {
    throw new Error(
      `Unable to make the esbuild module initializer of ${fileName} cycle-safe; the esbuild runtime helper changed`
    );
  }

  let replacement =
    cycleSafeEsmHelper(match[1]!, match[2]!, match[3]!, match[4]!) +
    '\n'.repeat(match[0].split('\n').length - 1);

  return code.slice(0, match.index) + replacement + code.slice(match.index + match[0].length);
};
