import jack from '@boxyhq/saml-jackson';
import { SQL } from 'bun';
import { env } from '../env';

let ensureDatabase = async (url: string) => {
  let parsed = new URL(url);
  let dbName = parsed.pathname.slice(1);
  parsed.pathname = '/postgres';

  let sql = new SQL(parsed.toString(), {
    tls: env.service.SSO_DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
  });
  let [row] = await sql`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
  if (!row) {
    await sql.unsafe(`CREATE DATABASE "${dbName}"`);
  }
  await sql.close();
};

await ensureDatabase(env.service.SSO_DATABASE_URL);

let ret = await jack({
  noAnalytics: true,
  externalUrl: env.service.ARES_SSO_URL,
  samlPath: '/sso/jxn/saml/callback',
  oidcPath: '/sso/jxn/oidc/callback',
  samlAudience: env.sso.SAML_AUDIENCE,
  db: {
    engine: 'sql',
    type: 'postgres',
    url: env.service.SSO_DATABASE_URL,
    ssl: env.service.SSO_DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
  },
  idpEnabled: true
});

export let jackson = {
  apiController: ret.apiController,
  oauthController: ret.oauthController,

  redirectUrl: `${env.service.ARES_SSO_URL}/*`,
  defaultRedirectUrl: {
    saml: `${env.service.ARES_SSO_URL}/sso/jxn/saml/callback`,
    oidc: `${env.service.ARES_SSO_URL}/sso/jxn/oidc/callback`
  }
};
