import { readFile } from 'node:fs/promises';
import type { Plugin } from 'esbuild';

export let postgresSamlPlugin = (): Plugin => ({
  name: 'postgres-saml-storage',

  setup(build) {
    // TypeORM also lists its optional Mongo driver in an eager CommonJS require switch.
    build.onLoad(
      { filter: /[/\\]typeorm[/\\]platform[/\\]PlatformTools\.js$/ },
      async args => ({
        contents: (await readFile(args.path, 'utf8')).replace(
          /return require\(["']mongodb["']\);/g,
          "throw new Error('On-prem SSO uses Postgres storage');"
        ),
        loader: 'js'
      })
    );

    // Jackson eagerly imports every database adapter, although Ares always selects Postgres.
    build.onLoad(
      { filter: /[/\\]@boxyhq[/\\]saml-jackson[/\\]dist[/\\]db[/\\]mongo\.js$/ },
      () => ({
        contents: `module.exports = class UnavailableMongoStorage {
        static new() { throw new Error('On-prem SSO uses Postgres storage'); }
      };`,
        loader: 'js'
      })
    );
  }
});
