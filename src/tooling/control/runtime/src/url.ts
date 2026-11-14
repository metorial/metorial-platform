import type { DatabaseConfig } from './config';

type Env = Record<string, string | undefined>;

let partNames = ['USERNAME', 'PASSWORD', 'HOST', 'PORT', 'NAME'] as const;

let list = (value: string | string[] | undefined) =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

export let composeFromParts = (db: DatabaseConfig, env: Env): string | undefined => {
  for (let prefix of list(db.parts)) {
    let url = composeFromPrefix(db, prefix, env);
    if (url) return url;
  }

  return undefined;
};

let composeFromPrefix = (db: DatabaseConfig, prefix: string, env: Env) => {
  let values = Object.fromEntries(
    partNames.map(part => [part, env[`${prefix}_${part}`] || undefined])
  ) as Record<(typeof partNames)[number], string | undefined>;
  values.PORT ??= db.defaults?.port;
  values.NAME ??= db.defaults?.name;

  if (partNames.some(part => values[part] === undefined)) return undefined;

  let encode = db.encode ? encodeURIComponent : (value: string) => value;
  let query = db.query ? `?${db.query}` : '';

  return `postgres://${encode(values.USERNAME!)}:${encode(values.PASSWORD!)}@${values.HOST}:${values.PORT}/${values.NAME}${query}`;
};

export let resolveDatabaseUrl = (db: DatabaseConfig, env: Env): string | undefined => {
  let first = (names: string[]) =>
    names.map(name => env[name] || undefined).find(value => value !== undefined);
  let fromUrl = first(list(db.env));
  let fromParts = composeFromParts(db, env);
  let partsFirst = db.precedence === 'parts' || (!db.precedence && !!env.AWS_MODE);

  let primary = partsFirst ? (fromParts ?? fromUrl) : (fromUrl ?? fromParts);

  return primary ?? first(list(db.fallback));
};

export let describeSources = (db: DatabaseConfig) => {
  let parts = list(db.parts).map(prefix => `${prefix}_{USERNAME,PASSWORD,HOST,PORT,NAME}`);

  return [...list(db.env), ...parts, ...list(db.fallback)].join(' or ');
};

export let redactUrl = (value: string) => {
  try {
    let url = new URL(value);
    if (url.password) url.password = '****';

    return url.toString();
  } catch {
    return '<unparseable url>';
  }
};
