import { rpc, rest } from '@metorial/e2e/api';
import { e2eEndpoint } from '@metorial/e2e/env';
import { uniqueId } from '@lowerdeck/testing-tools';
import JSZip from 'jszip';
import type { SlatesRegistryClient } from '../src/apis/internal';

let packageName = '@metorial/slates-registry';

export let registryClient = rpc<SlatesRegistryClient>(
  `${e2eEndpoint(packageName, 'internal')}/slates-registry`
);

export let publicUrl = () => e2eEndpoint(packageName, 'public');

export let publicApi = (token?: string, headers?: Record<string, string>) =>
  rest(publicUrl(), { apiKey: token, headers });

export type PackageFiles = Record<string, string>;

export let slatePackageFiles = (d: {
  scope: string;
  slate: string;
  version?: string;
  manifest?: Record<string, unknown>;
  packageJson?: Record<string, unknown>;
  extra?: PackageFiles;
}): PackageFiles => ({
  'package.json': JSON.stringify({
    name: `@${d.scope}/${d.slate}`,
    version: d.version ?? '1.0.0',
    main: 'dist/index.js',
    ...d.packageJson
  }),
  'slate.json': JSON.stringify({ name: `@${d.scope}/${d.slate}`, ...d.manifest }),
  'dist/index.js': 'module.exports = {};',
  ...d.extra
});

export let buildZip = async (files: PackageFiles) => {
  let zip = new JSZip();
  for (let [path, content] of Object.entries(files)) zip.file(path, content);
  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
};

export let uploadVersion = async (d: {
  token?: string;
  scope: string;
  slate: string;
  version: string;
  body: Buffer | string;
  contentType?: string | null;
  query?: Record<string, string>;
}) => {
  let url = new URL(`${publicUrl()}/slates/${d.scope}/${d.slate}/versions/${d.version}`);
  for (let [key, value] of Object.entries(d.query ?? {})) url.searchParams.set(key, value);

  let response = await fetch(url, {
    method: 'PUT',
    headers: {
      ...(d.contentType === null ? {} : { 'content-type': d.contentType ?? 'application/zip' }),
      ...(d.token ? { authorization: `Bearer ${d.token}` } : {})
    },
    body: typeof d.body == 'string' ? d.body : new Uint8Array(d.body)
  });

  let text = await response.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return { status: response.status, body };
};

export let createTenant = async () =>
  registryClient.tenant.upsert({ identifier: uniqueId('tenant'), name: 'E2E Tenant' });

export let createPublisher = async (tenant?: { id: string }) => {
  let owner = tenant ?? (await createTenant());
  let user = await registryClient.user.create({
    tenantId: owner.id,
    identifier: uniqueId('user'),
    name: 'E2E Publisher'
  });
  let token = await registryClient.user.token.create({
    tenantId: owner.id,
    userId: user.id,
    name: 'e2e'
  });

  return { tenant: owner, user, token: token.secret, scope: user.identifier };
};

export type Publisher = Awaited<ReturnType<typeof createPublisher>>;

export let publishSlate = async (
  publisher: Publisher,
  d: {
    slate?: string;
    version?: string;
    manifest?: Record<string, unknown>;
    extra?: PackageFiles;
    query?: Record<string, string>;
  } = {}
) => {
  let slate = d.slate ?? uniqueId('slate');
  let version = d.version ?? '1.0.0';
  let body = await buildZip(
    slatePackageFiles({
      scope: publisher.scope,
      slate,
      version,
      manifest: d.manifest,
      extra: d.extra
    })
  );

  let result = await uploadVersion({
    token: publisher.token,
    scope: publisher.scope,
    slate,
    version,
    body,
    query: d.query
  });
  if (result.status !== 200) {
    throw new Error(`publish failed: ${result.status} ${JSON.stringify(result.body)}`);
  }

  return { slate, version, body, published: result.body };
};

export let listAll = async <T extends { id: string }>(
  api: ReturnType<typeof publicApi>,
  path: string,
  query: Record<string, string> = {}
) => {
  let items: T[] = [];
  let after: string | undefined;

  while (true) {
    let response = await api.get(path, { query: { ...query, limit: '100', after } });
    if (!response.ok) throw new Error(`${path}: ${response.status} ${response.text}`);

    items.push(...response.body.items);
    if (!response.body.pagination.has_more_after || response.body.items.length == 0) {
      return items as T[];
    }
    after = response.body.items[response.body.items.length - 1].id;
  }
};

export let expectRpcError = async (promise: Promise<unknown>, code: string) => {
  let error: any;
  try {
    await promise;
  } catch (caught) {
    error = caught;
  }

  if (!error) throw new Error(`Expected an error "${code}", but the call resolved`);
  if (error.data?.code !== code) {
    throw new Error(`Expected an error "${code}", but got: ${error.stack ?? error}`);
  }

  return error.data as { code: string; message: string };
};
