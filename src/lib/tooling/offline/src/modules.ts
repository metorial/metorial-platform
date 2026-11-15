import { createOfflineValue, recordStubbedCall } from './stub';

let pluginStateKey = Symbol.for('lowerdeck.offline.modules.installed');

// Connection factories that some modules await at import time. Bun's runtime plugins can't
// intercept bare specifiers, so the library file that defines only the factory is replaced
// and the rest of the library stays real.
let moduleOverrides: { file: RegExp; exports: Record<string, unknown> }[] = [
  {
    file: /[\\/]node_modules[\\/]nats[\\/]lib[\\/]src[\\/]connect\.js$/,
    exports: {
      __esModule: true,
      connect: async () => {
        recordStubbedCall('nats');
        return createOfflineValue('nats');
      }
    }
  }
];

export let installModuleStubs = () => {
  if ((globalThis as any)[pluginStateKey] || typeof Bun == 'undefined') return;
  (globalThis as any)[pluginStateKey] = true;

  Bun.plugin({
    name: 'lowerdeck-offline-modules',
    setup: build => {
      for (let override of moduleOverrides) {
        build.onLoad({ filter: override.file }, () => ({
          loader: 'object',
          exports: override.exports
        }));
      }
    }
  });
};
