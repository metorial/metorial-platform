import { defineSettings, describeSettings, resetSettingsRegistry } from '@metorial/settings';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let touched = [
  'METORIAL_EDITION',
  'METORIAL_PUBLIC_URL',
  'METORIAL_POSTGRES_URL',
  'REDIS_URL',
  'APP_URL',
  'METORIAL_ENV',
  'EMAIL_ADDRESS',
  'EMAIL_NAME',
  'METORIAL_OWNED_DOMAINS',
  'PUBLIC_MCP_URL',
  'VOYAGER_URL',
  'LOWERDECK_OFFLINE'
];

let load = async () => {
  vi.resetModules();
  return await import('../src');
};

beforeEach(() => {
  resetSettingsRegistry();
});

afterEach(() => {
  for (let key of touched) delete process.env[key];
});

describe('infrastructure settings', () => {
  it('are deployment values in cloud and customer values on-prem', async () => {
    process.env.REDIS_URL = 'redis://localhost';

    let cloud = await load();
    defineSettings('service', { redisUrl: cloud.redisUrl });
    expect(describeSettings()[0]?.audience).toBe('deployment');

    resetSettingsRegistry();
    process.env.METORIAL_EDITION = 'on-prem';

    let onPrem = await load();
    defineSettings('service', { redisUrl: onPrem.redisUrl });
    expect(describeSettings()[0]?.audience).toBe('customer');
  });

  it('work under the legacy key style without changing the accessor', async () => {
    process.env.REDIS_URL = 'redis://localhost';

    let { redisUrl } = await load();
    let { defineSettings: define } = await import('@metorial/settings');

    expect(define({ service: { REDIS_URL: redisUrl } }).service.REDIS_URL).toBe(
      'redis://localhost'
    );
  });
});

describe('installation settings', () => {
  it('are optional in cloud', async () => {
    let { installationSettings } = await load();

    expect(installationSettings().publicUrl).toBeUndefined();
  });

  it('require the public url on-prem and strip trailing slashes', async () => {
    process.env.METORIAL_EDITION = 'on-prem';

    let missing = await load();
    expect(() => missing.installationSettings()).toThrow('METORIAL_PUBLIC_URL');

    process.env.METORIAL_PUBLIC_URL = 'https://metorial.example.com/';

    let { installationSettings } = await load();
    expect(installationSettings().publicUrl).toBe('https://metorial.example.com');
  });
});

describe('platform settings', () => {
  it('derives the app url from the public url on-prem', async () => {
    process.env.METORIAL_EDITION = 'on-prem';
    process.env.METORIAL_PUBLIC_URL = 'https://metorial.example.com';

    let { publicUrls } = await load();
    let { defineSettings: define } = await import('@metorial/settings');

    process.env.API_URL = 'https://metorial.example.com/api';
    process.env.FILES_URL = 'https://metorial.example.com/files';
    process.env.PORTALS_URL = 'https://metorial.example.com/portals';

    let urls = define('urls', publicUrls);

    expect(urls.appUrl).toBe('https://metorial.example.com');
    expect(urls.publicMcpUrl).toBeUndefined();

    for (let key of ['API_URL', 'FILES_URL', 'PORTALS_URL']) delete process.env[key];
  });

  it('only configures public mcp in the cloud edition', async () => {
    process.env.PUBLIC_MCP_URL = 'https://mcp.example.com';

    let { publicUrls } = await load();
    let { defineSettings: define } = await import('@metorial/settings');

    process.env.LOWERDECK_OFFLINE = '1';

    expect(define('urls', publicUrls).publicMcpUrl).toBe('https://mcp.example.com');
  });

  it('defaults the environment to production on-prem only', async () => {
    process.env.METORIAL_EDITION = 'on-prem';

    let { metorialEnv } = await load();
    let { defineSettings: define } = await import('@metorial/settings');

    expect(define('environment', { environment: metorialEnv }).environment).toBe('production');
  });
});

describe('database settings', () => {
  it('replaces the database name of the server url', async () => {
    let { withDatabaseName } = await load();

    expect(withDatabaseName('postgres://user:pw@db.example.com:5432', 'core')).toBe(
      'postgres://user:pw@db.example.com:5432/core'
    );
  });

  it('derives per service databases from the customer postgres server on-prem', async () => {
    process.env.METORIAL_EDITION = 'on-prem';
    process.env.METORIAL_POSTGRES_URL = 'postgres://user:pw@db.example.com:5432';

    let { databaseUrl } = await load();
    let { defineSettings: define } = await import('@metorial/settings');

    expect(define('database', { url: databaseUrl('DATABASE_URL', 'metorial_core') }).url).toBe(
      'postgres://user:pw@db.example.com:5432/metorial_core'
    );
  });
});

describe('service urls', () => {
  it('use the registered env var name', async () => {
    process.env.VOYAGER_URL = 'http://voyager:3000';

    let { serviceUrl } = await load();
    let { defineSettings: define } = await import('@metorial/settings');

    expect(define('services', { voyager: serviceUrl('voyager') }).voyager).toBe(
      'http://voyager:3000'
    );
  });
});

describe('email sender settings', () => {
  it('require an address and default the name on-prem only', async () => {
    process.env.METORIAL_EDITION = 'on-prem';
    process.env.EMAIL_ADDRESS = 'metorial@example.com';

    let { emailName, emailAddress } = await load();
    let { defineSettings: define } = await import('@metorial/settings');

    let sender = define('email', { EMAIL_NAME: emailName, EMAIL_ADDRESS: emailAddress });

    expect(sender.EMAIL_NAME).toBe('Metorial');
    expect(sender.EMAIL_ADDRESS).toBe('metorial@example.com');

    delete process.env.EMAIL_ADDRESS;
    process.env.METORIAL_EDITION = 'cloud';

    let cloud = await load();
    let { defineSettings: defineCloud } = await import('@metorial/settings');

    expect(() =>
      defineCloud('email', { EMAIL_NAME: cloud.emailName, EMAIL_ADDRESS: cloud.emailAddress })
    ).toThrow('EMAIL_NAME');
  });
});

describe('domain settings', () => {
  it('keep the metorial domains in the cloud edition without localhost', async () => {
    let { domainSettings, matchesDomain } = await load();
    let domains = domainSettings();

    expect(domains.owned).toContain('metorial.net');
    expect(domains.assets).toEqual(['metorial-cdn.com', 'metorial-files.com']);
    expect(domains.dev).toEqual([]);
    expect(matchesDomain('api.metorial.com', domains.apps)).toBe(true);
    expect(matchesDomain('evil-metorial.com', domains.apps)).toBe(false);
  });

  it('only trust localhost while developing', async () => {
    process.env.METORIAL_ENV = 'development';

    let { domainSettings } = await load();

    expect(domainSettings().dev).toEqual(['localhost']);
  });

  it('use the installation host on-prem', async () => {
    process.env.METORIAL_EDITION = 'on-prem';
    process.env.METORIAL_PUBLIC_URL = 'https://metorial.example.com/';

    let { domainSettings } = await load();
    let domains = domainSettings();

    expect(domains.apps).toEqual(['metorial.example.com']);
    expect(domains.owned).toEqual(['metorial.example.com']);
    expect(domains.assets).toEqual(['metorial.example.com']);
  });

  it('can be extended by operators', async () => {
    process.env.METORIAL_OWNED_DOMAINS = 'acme.corp, intranet.acme.corp';

    let { domainSettings, matchesDomain } = await load();

    expect(matchesDomain('docs.acme.corp', domainSettings().owned)).toBe(true);
  });

  it('matches bare domains, subdomains and leading dots', async () => {
    let { matchesDomain } = await load();

    expect(matchesDomain('metorial.com', ['.metorial.com'])).toBe(true);
    expect(matchesDomain('a.b.metorial.com', ['metorial.com'])).toBe(true);
    expect(matchesDomain('METORIAL.com', ['metorial.com'])).toBe(true);
    expect(matchesDomain('metorial.com.evil.io', ['metorial.com'])).toBe(false);
  });
});
