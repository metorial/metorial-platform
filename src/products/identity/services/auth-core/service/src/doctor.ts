import { check, probes, type CheckDefinition } from '@lowerdeck/doctor';
import {
  baselineChecks,
  bunRedis,
  dependencyCheck,
  tcpAddress,
  postgresChecks,
  prismaQuery,
  queueChecks,
  redisChecks,
  rpcDependencyCheck
} from '@metorial/doctor';
import { db } from '@mtsrc/auth-core-db';
import type { RedisClient } from 'bun';
import { env } from './env';

let certificateWarnDays = 30;
let dayMs = 24 * 60 * 60 * 1000;

let originOf = (value: string) => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

export let publicUrlsCheck = (
  settings: { authUrl: string; ssoUrl: string },
  publicUrl: string | undefined
): CheckDefinition =>
  check({
    id: 'auth.public-urls',
    title: 'The sign-in URLs match the public URL',
    category: 'configuration',
    severity: 'critical',
    run: ctx => {
      if (!publicUrl) return ctx.skip('METORIAL_PUBLIC_URL is not used here.');

      let expected = originOf(publicUrl);
      let mismatched = Object.entries({
        ARES_AUTH_URL: settings.authUrl,
        ARES_SSO_URL: settings.ssoUrl
      }).filter(([, value]) => originOf(value) != expected);

      if (mismatched.length) {
        return ctx.fail({
          message: `${mismatched.map(([name, value]) => `${name} is ${value}`).join(' and ')}, but the public URL is ${expected}. Sign-in redirects and cookies break.`,
          resolution: {
            summary:
              'Remove overrides of ARES_AUTH_URL and ARES_SSO_URL; the chart derives them from the public URL.',
            docs: 'datacenter/operations/doctor#public-url'
          },
          details: { expected, mismatched: mismatched.map(([name]) => name) }
        });
      }

      return ctx.pass(`Sign-in uses ${expected}.`);
    }
  });

export let samlAudienceCheck = (
  audience: string,
  publicUrl: string | undefined
): CheckDefinition =>
  check({
    id: 'sso.saml-audience',
    title: 'The SAML audience matches the public URL',
    category: 'configuration',
    severity: 'warning',
    run: ctx => {
      if (!publicUrl) return ctx.skip('METORIAL_PUBLIC_URL is not used here.');

      let expected = originOf(publicUrl);
      if (audience == expected || originOf(audience) == expected) {
        return ctx.pass('The SAML audience is the public URL.');
      }

      return ctx.warn({
        message: `SAML_AUDIENCE is ${audience}, not ${expected}. Identity providers configured with another audience stop working after a URL change.`,
        resolution: {
          summary:
            'Keep SAML_AUDIENCE stable once identity providers use it; set it to the public URL on new installations.',
          docs: 'datacenter/operations/doctor#sso'
        },
        details: { audience, expected }
      });
    }
  });

export let twoFactorKeyCheck = (
  setupEnabled: string | undefined,
  key: string | undefined
): CheckDefinition =>
  check({
    id: 'auth.two-factor-key',
    title: 'The two-factor encryption key is set',
    category: 'security',
    severity: 'critical',
    run: ctx => {
      if (setupEnabled != 'true') return ctx.skip('Two-factor setup is not enabled.');
      if (key) return ctx.pass('The two-factor encryption key is set.');

      return ctx.fail({
        message: 'Two-factor setup is enabled but TWO_FACTOR_ENCRYPTION_KEY is not set.',
        resolution: {
          summary: 'Set TWO_FACTOR_ENCRYPTION_KEY, or disable two-factor setup.',
          docs: 'datacenter/operations/doctor#sso'
        }
      });
    }
  });

type SamlConnection = { name: string; validTo: Date | null };

export let ssoCertificateCheck = (
  connections: () => Promise<SamlConnection[]>
): CheckDefinition =>
  check({
    id: 'sso.connections',
    title: 'SSO signing certificates are valid',
    category: 'security',
    severity: 'warning',
    run: async ctx => {
      let list = await connections();
      if (!list.length) return ctx.skip('No SSO connections are configured.');

      let now = Date.now();
      let expired = list.filter(item => item.validTo && item.validTo.getTime() < now);
      let expiring = list.filter(
        item =>
          item.validTo &&
          item.validTo.getTime() >= now &&
          item.validTo.getTime() - now < certificateWarnDays * dayMs
      );
      let details = {
        connections: list.length,
        expired: expired.map(item => item.name),
        expiring: expiring.map(item => item.name)
      };

      if (expired.length) {
        return ctx.fail({
          message: `The signing certificate of ${expired.map(item => item.name).join(', ')} has expired, so sign-in with it fails.`,
          resolution: {
            summary: 'Ask the identity provider for new metadata and update the connection.',
            docs: 'datacenter/operations/doctor#sso'
          },
          details
        });
      }

      if (expiring.length) {
        return ctx.warn({
          message: `The signing certificate of ${expiring.map(item => item.name).join(', ')} expires within ${certificateWarnDays} days.`,
          resolution: {
            summary:
              'Update the connection with the identity provider’s new metadata before it expires.',
            docs: 'datacenter/operations/doctor#sso'
          },
          details
        });
      }

      return ctx.pass(`${list.length} SSO connections have valid certificates.`, details);
    }
  });

let readSamlConnections = async (): Promise<SamlConnection[]> => {
  let { createSsoSql } = await import('@mtsrc/auth-core-module-sso/src/lib/ssoSql');
  let sql = createSsoSql(env.service.SSO_DATABASE_URL, env.service.SSO_DATABASE_SSL);

  try {
    let rows: { value: unknown }[];
    try {
      rows = await sql`SELECT value FROM jackson_store WHERE namespace = 'saml:config'`;
    } catch {
      return [];
    }

    return rows.flatMap(row => {
      try {
        let config = typeof row.value == 'string' ? JSON.parse(row.value) : row.value;
        let validTo = config?.idpMetadata?.validTo;

        return [
          {
            name: String(config?.name ?? config?.tenant ?? config?.clientID ?? 'connection'),
            validTo: validTo ? new Date(validTo) : null
          }
        ];
      } catch {
        return [];
      }
    });
  } finally {
    await sql.close();
  }
};

let passportCallbackCheck = (listeners: () => Promise<{ callbackUrl: string }[]>) =>
  check({
    id: 'dependencies.passport-callback',
    title: 'Registered sync callbacks are reachable',
    category: 'dependency',
    severity: 'critical',
    run: async ctx => {
      let urls = [...new Set((await listeners()).map(item => item.callbackUrl))];
      if (!urls.length) return ctx.skip('No sync listener is registered yet.');

      let unreachable: string[] = [];
      for (let url of urls) {
        let { host, port } = tcpAddress(url);

        // The probe throws when it can't connect; a slow connect only warns and is still reachable.
        try {
          await probes.tcp({ host, port })(ctx);
        } catch {
          unreachable.push(url);
        }
      }

      if (unreachable.length) {
        return ctx.fail({
          message: `Ares can't reach its sync callbacks ${unreachable.join(', ')}; users created in Ares don't reach the platform.`,
          resolution: {
            summary:
              'Check that the controller runs and its Ares port is reachable from auth-core.',
            docs: 'datacenter/operations/doctor#dependencies'
          },
          details: { unreachable }
        });
      }

      return ctx.pass('Every sync callback is reachable.', { callbacks: urls.length });
    }
  });

export let authCoreDoctorChecks = (redis: RedisClient): CheckDefinition[] => [
  ...baselineChecks(),
  ...postgresChecks({
    name: 'ares',
    query: prismaQuery(db),
    schemaProbe: () => db.app.count()
  }),
  ...redisChecks({ client: bunRedis(redis) }),
  ...queueChecks(),
  dependencyCheck({
    name: 'sso-database',
    title: 'The SSO database is reachable',
    severity: 'warning',
    tcp: env.service.SSO_DATABASE_URL
  }),
  rpcDependencyCheck({ name: 'email', endpoint: env.service.RELAY_URL }),
  publicUrlsCheck(
    { authUrl: env.service.ARES_AUTH_URL, ssoUrl: env.service.ARES_SSO_URL },
    process.env.METORIAL_PUBLIC_URL
  ),
  samlAudienceCheck(env.sso.SAML_AUDIENCE, process.env.METORIAL_PUBLIC_URL),
  twoFactorKeyCheck(env.service.TWO_FACTOR_SETUP_ENABLED, env.keys.TWO_FACTOR_ENCRYPTION_KEY),
  ssoCertificateCheck(readSamlConnections),
  passportCallbackCheck(() => db.syncListener.findMany({ select: { callbackUrl: true } }))
];
