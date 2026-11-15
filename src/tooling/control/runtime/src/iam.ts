import { Signer } from '@aws-sdk/rds-signer';
import type { DatabaseConfig } from './config';

type Env = Record<string, string | undefined>;

export let iamRegion = (url: URL, iam: NonNullable<DatabaseConfig['iam']>, env: Env) => {
  let arnRegion = env[iam.arnEnv]?.split(':')[3];
  if (arnRegion) return arnRegion;

  let hostParts = url.hostname.split('.');
  let hostRegion = hostParts.length >= 4 ? hostParts[hostParts.length - 4] : undefined;
  if (hostRegion) return hostRegion;

  return (
    (iam.regionEnv ? env[iam.regionEnv] : undefined) ??
    env.AWS_REGION ??
    env.AWS_DEFAULT_REGION
  );
};

export let signWithIam = async (
  value: string,
  iam: NonNullable<DatabaseConfig['iam']>,
  env: Env
) => {
  if (!env[iam.arnEnv]) return value;

  let url = new URL(value);
  let region = iamRegion(url, iam, env);
  if (!region) throw new Error('AWS region is required to sign the database url');

  let signer = new Signer({
    region,
    hostname: url.hostname,
    port: Number.parseInt(url.port || '5432', 10),
    username: decodeURIComponent(url.username)
  });
  let token = await signer.getAuthToken();
  if (!url.searchParams.has('sslmode')) url.searchParams.set('sslmode', 'no-verify');

  let username = encodeURIComponent(decodeURIComponent(url.username));
  let port = url.port ? `:${url.port}` : '';

  return `${url.protocol}//${username}:${encodeURIComponent(token)}@${url.hostname}${port}${url.pathname}${url.search}`;
};
