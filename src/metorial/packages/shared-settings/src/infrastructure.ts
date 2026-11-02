import { v } from '@lowerdeck/validation';
import { perEdition } from '@metorial/editions';
import { defineSettings, setting, type Audience } from '@metorial/settings';
import { once } from './once';

type LazyDefault = string | undefined | (() => string | undefined);

let infrastructure = perEdition<Audience>({ cloud: 'deployment', 'on-prem': 'customer' });

export let redisUrl = setting(v.string(), {
  env: 'REDIS_URL',
  audience: infrastructure,
  description: 'Redis connection URL'
});

export let objectStorageUrl = setting(v.string(), {
  env: 'OBJECT_STORAGE_URL',
  audience: infrastructure,
  description: 'Object storage connection URL'
});

export let postgresServerUrl = setting(v.string(), {
  env: 'METORIAL_POSTGRES_URL',
  audience: 'customer',
  requiredIn: ['on-prem'],
  secret: true,
  description:
    'Postgres server the installation databases are created on, for example postgres://user:password@db.example.com:5432'
});

let loadPostgres = once(() => defineSettings('postgres', { serverUrl: postgresServerUrl }));

export let postgresSettings = () => loadPostgres();

export let withDatabaseName = (serverUrl: string, databaseName: string) => {
  let url = new URL(serverUrl);
  url.pathname = `/${databaseName}`;

  return url.toString();
};

export let databaseUrl = (env: string, databaseName: string) =>
  setting(v.string(), {
    env,
    audience: 'deployment',
    description: `Connection URL of the ${databaseName} database`,
    default: perEdition<LazyDefault>({
      cloud: undefined,
      'on-prem': () => {
        let serverUrl = postgresSettings().serverUrl;
        return serverUrl ? withDatabaseName(serverUrl, databaseName) : undefined;
      }
    })
  });
