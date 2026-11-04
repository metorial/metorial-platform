import { createClient } from '@lowerdeck/rpc-client';
import { uniqueId } from '@lowerdeck/testing-tools';
import { e2eEndpoint } from '@metorial/e2e/env';
import type { GroundstationClient } from '../src/controllers';

export let packageName = '@metorial/groundstation';

export let stubStatus = 501;

export let apiUrl = () => e2eEndpoint(packageName, 'api');
export let ingestUrl = () => e2eEndpoint(packageName, 'ingest');

export let groundstation = () =>
  createClient<GroundstationClient>({ endpoint: `${apiUrl()}/metorial-groundstation` });

type TokenInput = Omit<
  Parameters<GroundstationClient['ingestToken']['create']>[0],
  'tenantId' | 'name'
> & { name?: string };

export let createTenant = async (
  input: { skewBoundSeconds?: number; backfillMaxAgeDays?: number | null } = {}
) => groundstation().tenant.upsert({ ref: uniqueId('org'), ...input });

export let createToken = async (input: TokenInput = {}) => {
  let tenant = await createTenant();

  let token = await groundstation().ingestToken.create({
    tenantId: tenant.id,
    name: uniqueId('laptop'),
    ...input
  });

  return { tenant, token, secret: token.secret };
};

export let ingest = (
  path: string,
  options: {
    credential?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: BodyInit | null;
  } = {}
) =>
  fetch(`${ingestUrl()}${path}`, {
    method: options.method ?? 'POST',
    headers: {
      'content-type': 'application/json',
      ...(options.credential ? { authorization: `Bearer ${options.credential}` } : {}),
      ...options.headers
    },
    body: options.method == 'GET' ? undefined : (options.body ?? '{}')
  });

export let errorCode = async (response: Response) =>
  ((await response.json()) as { code: string }).code;

export let rpcErrorCode = async (call: Promise<unknown>) => {
  try {
    await call;
  } catch (error) {
    return (error as { data?: { code?: string } }).data?.code;
  }

  return undefined;
};
