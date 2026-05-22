import type { ResolvedDatabase } from '../types';

export type InterpolateEnvContext = {
  depHosts: Record<string, { host: string; port?: number }>;
  databases?: Record<string, ResolvedDatabase>;
};

let buildDatabaseUrl = (db: ResolvedDatabase): string =>
  `postgresql://${db.user}:${db.password}@${db.host}:${db.port}/${db.name}`;

export let interpolateEnv = (
  env: Record<string, string>,
  context: InterpolateEnvContext | Record<string, { host: string; port?: number }>
): Record<string, string> => {
  let depHosts =
    'depHosts' in context ? context.depHosts : (context as Record<string, { host: string; port?: number }>);
  let databases = 'depHosts' in context ? context.databases : undefined;
  let result: Record<string, string> = {};

  for (let [key, value] of Object.entries(env)) {
    let next = value;

    if (databases) {
      next = next.replace(/\$db\.([a-zA-Z0-9_-]+)\.url/g, (_match, name: string) => {
        let db = databases[name];
        if (!db) throw new Error(`Unknown database "${name}" in env var ${key}=${value}`);
        return buildDatabaseUrl(db);
      });

      next = next.replace(
        /\$db\.([a-zA-Z0-9_-]+)\.(user|password|name|host|port)/g,
        (_match, name: string, field: string) => {
          let db = databases[name];
          if (!db) throw new Error(`Unknown database "${name}" in env var ${key}=${value}`);
          if (field === 'user') return db.user;
          if (field === 'password') return db.password;
          if (field === 'name') return db.name;
          if (field === 'host') return db.host;
          if (field === 'port') return String(db.port);
          return _match;
        }
      );
    }

    next = next.replace(/\$deps\.([a-zA-Z0-9_-]+)(?:\.(\d+)|\.url)?/g, (match, name: string, port?: string) => {
      let dep = depHosts[name];
      if (!dep) throw new Error(`Unknown dependency "${name}" in env var ${key}=${value}`);
      if (match.endsWith('.url')) {
        return `http://${dep.host}:${port ?? dep.port ?? 80}`;
      }
      if (port) return `${dep.host}:${port}`;
      return dep.host;
    });

    result[key] = next;
  }

  return result;
};

export let mergeEnv = (
  ...layers: Record<string, string>[]
): Record<string, string> => Object.assign({}, ...layers);
