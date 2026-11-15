import type {
  BundleRef,
  FunctionEnsureInputEntrypoint,
  FunctionEnsureInputEntrypointKind,
  FunctionEnsureInputMode
} from '@metorial-platform-systems/cluster-manager-client';
import { db } from '../../db';
import { encryption } from '../../encryption';
import { env } from '../../env';
import { storage } from '../../storage';
import { getClusterManager } from './clusterManager';

export let KNATIVE_RUNTIME = { identifier: 'nodejs' as const, version: '24' };

export type KnativeProviderData = {
  bundle: BundleRef;
  entrypoint: FunctionEnsureInputEntrypoint;
  runtimeIdentifier: string;
  encryptedEnvironmentVariables: string;
};

export let entrypointFromHandler = (
  handler: string,
  kind: FunctionEnsureInputEntrypointKind
): FunctionEnsureInputEntrypoint => {
  let separator = handler.lastIndexOf('.');
  let modulePath = separator > 0 ? handler.slice(0, separator) : handler;
  let exportName = separator > 0 ? handler.slice(separator + 1) : 'handler';

  return {
    path: /\.[cm]?js$/.test(modulePath) ? modulePath : `${modulePath}.js`,
    export: exportName || 'handler',
    kind
  };
};

export let importBundle = async (d: {
  functionVersion: { id: string };
  source: { bucket: string; key: string };
}) =>
  await getClusterManager().bundle.import({
    versionId: d.functionVersion.id,
    source: d.source
  });

export let importBundleFromUrl = async (d: {
  functionVersion: { id: string };
  zipFileUrl: string;
}) => {
  let res = await fetch(d.zipFileUrl);
  if (!res.ok) {
    throw new Error(`Failed to download function bundle: ${res.status} ${res.statusText}`);
  }

  let bucket = env.storage.BUNDLE_BUCKET_NAME;
  let key = `knative/sources/${d.functionVersion.id}.zip`;
  await storage.putObject(
    bucket,
    key,
    Buffer.from(await res.arrayBuffer()),
    'application/zip'
  );

  return await importBundle({ functionVersion: d.functionVersion, source: { bucket, key } });
};

export let createKnativeProviderData = async (d: {
  functionVersion: { id: string };
  bundle: BundleRef;
  entrypoint: FunctionEnsureInputEntrypoint;
  runtime: { identifier: string };
  env: Record<string, string>;
}): Promise<KnativeProviderData> => ({
  bundle: d.bundle,
  entrypoint: d.entrypoint,
  runtimeIdentifier: d.runtime.identifier,
  encryptedEnvironmentVariables: await encryption.encrypt({
    entityId: d.functionVersion.id,
    secret: JSON.stringify(d.env)
  })
});

let tenantIds = new Map<bigint, string>();

let getTenantId = async (tenantOid: bigint) => {
  let id = tenantIds.get(tenantOid);
  if (!id) {
    id = (
      await db.tenant.findUniqueOrThrow({ where: { oid: tenantOid }, select: { id: true } })
    ).id;
    tenantIds.set(tenantOid, id);
  }

  return id;
};

export let ensureKnativeFunction = async (d: {
  mode: FunctionEnsureInputMode;
  functionVersion: { id: string };
  function: { id: string; tenantOid: bigint };
  configuration: PrismaJson.FunctionConfiguration;
  providerData: Pick<KnativeProviderData, 'bundle' | 'entrypoint'>;
  env: Record<string, string>;
  timeoutMs?: number;
}) =>
  await getClusterManager().function.ensure(
    {
      versionId: d.functionVersion.id,
      functionId: d.function.id,
      tenantId: await getTenantId(d.function.tenantOid),
      mode: d.mode,
      runtime: KNATIVE_RUNTIME,
      entrypoint: d.providerData.entrypoint,
      bundle: d.providerData.bundle,
      env: d.env,
      memoryMb: d.configuration.memorySizeMb,
      timeoutSeconds: d.configuration.timeoutSeconds,
      concurrency: d.configuration.concurrency ?? 'exclusive',
      sandbox: d.configuration.sandbox
    },
    d.timeoutMs ? { timeoutMs: d.timeoutMs } : undefined
  );
