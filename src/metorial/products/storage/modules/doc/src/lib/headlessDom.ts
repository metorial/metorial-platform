import { JSDOM } from 'jsdom';

let domGlobalKeys = ['window', 'document', 'DOMParser', 'Node'] as const;

let headlessWindow: JSDOM['window'] | undefined;

let hasDom = () =>
  typeof (globalThis as any).document !== 'undefined' &&
  typeof (globalThis as any).DOMParser !== 'undefined';

// Markdown parsing in tiptap goes through the DOM, which the server doesn't have. The globals
// are installed only for the duration of a synchronous callback so that no other code running on
// this process ever observes a browser-like environment.
export let withHeadlessDom = <T>(cb: () => T): T => {
  if (hasDom()) return cb();

  headlessWindow ??= new JSDOM('<!doctype html><html><body></body></html>').window;

  let previous = domGlobalKeys.map(
    key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const
  );

  for (let key of domGlobalKeys) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value: key == 'window' ? headlessWindow : (headlessWindow as any)[key]
    });
  }

  try {
    let result = cb();
    if (result instanceof Promise) {
      throw new Error('withHeadlessDom callbacks must be synchronous');
    }

    return result;
  } finally {
    for (let [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as any)[key];
    }
  }
};
