import type { MirrorUpstream } from '../../../prisma/generated/client';

let requestTimeoutMs = 30 * 1000;

let downloadTimeoutMs = 5 * 60 * 1000;

export type UpstreamChangeNotification = {
  id: string;
  type: string;
  slate: { fullIdentifier: string };
  slateVersion: { id: string; identifier: string | null } | null;
};

export type UpstreamSlate = {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  fullIdentifier: string;
};

export type UpstreamSlateVersion = {
  id: string;
  version: string;
  contentChecksum?: string | null;
  signatures?: { kid: string; signature: string }[];
};

export class UpstreamRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

let splitIdentifier = (fullIdentifier: string) => {
  let [scope, slate] = fullIdentifier.replace(/^@/, '').split('/');
  if (!scope || !slate) throw new Error(`Invalid slate identifier ${fullIdentifier}`);

  return { scope: encodeURIComponent(scope), slate: encodeURIComponent(slate) };
};

let request = async (
  upstream: Pick<MirrorUpstream, 'url' | 'subRegistryId'>,
  path: string,
  query: Record<string, string | undefined>,
  timeoutMs = requestTimeoutMs
) => {
  let url = new URL(`${upstream.url}${path}`);
  for (let [key, value] of Object.entries(query)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }

  let headers: Record<string, string> = { Accept: 'application/json' };
  if (upstream.subRegistryId) {
    headers['Metorial-Sub-Registry-Id'] = upstream.subRegistryId;
    headers['Slates-Sub-Registry-Id'] = upstream.subRegistryId;
  }

  let response = await fetch(url, {
    headers,
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) {
    let body = await response.text().catch(() => '');
    throw new UpstreamRequestError(
      `Upstream ${url.pathname} returned ${response.status}: ${body.slice(0, 500)}`,
      response.status
    );
  }

  return response;
};

export let createUpstreamClient = (
  upstream: Pick<MirrorUpstream, 'url' | 'subRegistryId'>
) => ({
  listChangeNotifications: async (d: { after?: string | null; limit: number }) => {
    let response = await request(upstream, '/change-notifications', {
      limit: String(d.limit),
      after: d.after ?? undefined,
      order: 'asc',
      supports_prebuilt: 'true'
    });

    return (await response.json()) as { items: UpstreamChangeNotification[] };
  },

  getSlate: async (fullIdentifier: string) => {
    let { scope, slate } = splitIdentifier(fullIdentifier);
    let response = await request(upstream, `/slates/${scope}/${slate}`, {
      supports_prebuilt: 'true'
    });

    return (await response.json()) as UpstreamSlate;
  },

  getSlateVersion: async (fullIdentifier: string, version: string) => {
    let { scope, slate } = splitIdentifier(fullIdentifier);
    let response = await request(
      upstream,
      `/slates/${scope}/${slate}/versions/${encodeURIComponent(version)}`,
      { supports_prebuilt: 'true' }
    );

    return (await response.json()) as UpstreamSlateVersion;
  },

  // Proxied through the registry so restrictive egress only needs the registry host.
  downloadSlateVersion: async (fullIdentifier: string, version: string) => {
    let { scope, slate } = splitIdentifier(fullIdentifier);
    let response = await request(
      upstream,
      `/slates/${scope}/${slate}/versions/${encodeURIComponent(version)}/download`,
      { supports_prebuilt: 'true', proxy: 'true' },
      downloadTimeoutMs
    );

    return Buffer.from(await response.arrayBuffer());
  }
});
