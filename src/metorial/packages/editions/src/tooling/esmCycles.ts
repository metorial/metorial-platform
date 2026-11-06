let esmHelper =
  /var __esm = \((\w+), (\w+), (\w+)\) => function\(\) \{\s*if \(\3\) throw \3\[0\];\s*try \{\s*return \1 && \(\2 = \(0, \1\[__getOwnPropNames\(\1\)\[0\]\]\)\(\1 = 0\)\), \2;\s*\} catch \((\w+)\) \{\s*throw \3 = \[\4\], \4;\s*\}\s*\};/;

// esbuild wraps modules that cannot be hoisted (dynamic imports, top-level await) in a lazy
// initializer. When an async initializer is re-entered through an import cycle it hands back its
// own pending promise, so the module ends up awaiting itself and the process hangs silently.
// The replacement keeps the helper's line count so source maps stay aligned. Native ESM skips a module that is already being evaluated further up the import chain, so the
// replacement helper tracks that chain through async context and does the same.
let cycleSafeEsmHelper = (fn: string, res: string, err: string, e: string) =>
  [
    `var __esmChain = new (require("node:async_hooks").AsyncLocalStorage)();`,
    `var __esm = (${fn}, ${res}, ${err}, self) => (self = function() {`,
    `if (${err}) throw ${err}[0];`,
    `if (!${fn}) { for (let link = __esmChain.getStore(); link; link = link.parent) if (link.module === self) return; return ${res}; }`,
    `try { let init = ${fn}[__getOwnPropNames(${fn})[0]]; ${fn} = 0; return ${res} = __esmChain.run({ module: self, parent: __esmChain.getStore() }, () => init(0)), ${res}; }`,
    `catch (${e}) { throw ${err} = [${e}], ${e}; }`,
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
