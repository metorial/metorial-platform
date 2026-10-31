import { inlineConfigElementId } from './runtime.ts';

let escapeForHtml = (json: string) =>
  json
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');

export let inlineConfigPlugin = (keys: string[]) => {
  let values: Record<string, string> = {};
  let isBuild = false;

  return {
    name: 'metorial-inline-config',

    config: (_config: unknown, env: { command: string }) => {
      isBuild = env.command == 'build';
      if (!isBuild) return;

      return {
        define: Object.fromEntries(
          keys.map(key => [`import.meta.env.${key}`, 'undefined'] as const)
        )
      };
    },

    configResolved: (config: { env: Record<string, unknown> }) => {
      values = Object.fromEntries(
        keys
          .map(key => [key, config.env[key]] as const)
          .filter((entry): entry is [string, string] => typeof entry[1] == 'string')
      );
    },

    transformIndexHtml: () =>
      isBuild
        ? [
            {
              tag: 'script',
              attrs: { id: inlineConfigElementId, type: 'application/json' },
              children: escapeForHtml(JSON.stringify(values)),
              injectTo: 'head-prepend' as const
            }
          ]
        : []
  };
};
