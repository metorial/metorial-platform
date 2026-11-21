import { readFile } from 'node:fs/promises';
import type { Plugin } from 'esbuild';

export let samlJacksonImportsPlugin = (): Plugin => ({
  name: 'saml-jackson-imports',

  setup(build) {
    build.onLoad(
      { filter: /[/\\]@boxyhq[/\\]saml-jackson[/\\]dist[/\\]controller[/\\]utils\.js$/ },
      async args => {
        let code = await readFile(args.path, 'utf8');

        // Jackson hides these lazy ESM imports inside a generated function. Literal specifiers
        // let esbuild bundle each dependency from Jackson's own installation.
        let contents = code.replace(
          "return new Function(`return import('${packageName}')`)();",
          `
          if (packageName === 'jose') return import('jose');
          if (packageName === 'openid-client') return import('openid-client');
          return import(packageName);
        `
        );

        if (contents === code) return;

        return { contents, loader: 'js' };
      }
    );
  }
});
