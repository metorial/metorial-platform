import { createCron } from '@mtsrc/cron';
import { createLock } from '@mtsrc/lock';
import { createQueue } from '@mtsrc/queue';
import semver from 'semver';
import { db } from '../db';
import { env } from '../env';
import { randomIntBetween } from '../lib/randomNumber';
import { createZipBuffer, readTarballEntries } from '../lib/slatePackage/archive';
import { normalizeSlatePackage } from '../lib/slatePackage/manifest';
import { tenantService, workspaceService } from '../services';
import { slateVersionService } from '../services/slateVersion';
import { userService } from '../services/user';

let pageSize = 250;

let defaultTenant = tenantService.upsertTenant({
  input: {
    name: 'Metorial',
    identifier: 'metorial'
  }
});

let getNpmRegistryUrl = () =>
  (env.npm.NPM_REGISTRY_URL ?? 'https://registry.npmjs.org').replace(/\/+$/, '');

let getNpmHeaders = () => {
  let headers: Record<string, string> = {};
  if (env.npm.NPM_TOKEN) {
    headers.Authorization = `Bearer ${env.npm.NPM_TOKEN}`;
  }

  return Object.keys(headers).length > 0 ? headers : undefined;
};

let fetchJson = async <T>(url: string) => {
  let response = await fetch(url, {
    headers: getNpmHeaders()
  });
  if (!response.ok) {
    throw new Error(`Failed npm request ${url}: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
};

let fetchBuffer = async (url: string) => {
  let response = await fetch(url, {
    headers: getNpmHeaders()
  });
  if (!response.ok) {
    throw new Error(
      `Failed npm tarball request ${url}: ${response.status} ${response.statusText}`
    );
  }

  return Buffer.from(await response.arrayBuffer());
};

export let syncNpmCronProcessor = createCron(
  {
    name: 'sreg/slate/npm/sync',
    cron: '* * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    if (!env.npm.NPM_ORG) return;
    await syncNpmPackagesQueue.add({ cursor: 0 }, { id: 'page_0' });
  }
);

let syncNpmPackagesQueue = createQueue<{
  cursor: number;
}>({
  name: 'sreg/slate/npm/many',
  redisUrl: env.service.REDIS_URL
});

if (process.env.NODE_ENV === 'development') {
  await syncNpmPackagesQueue.add({ cursor: 0 }, { id: 'page_0' });
}

export let syncNpmPackagesQueueProcessor = syncNpmPackagesQueue.process(async data => {
  if (!env.npm.NPM_ORG) return;

  let normalizedOrg = env.npm.NPM_ORG.startsWith('@')
    ? env.npm.NPM_ORG.slice(1)
    : env.npm.NPM_ORG;

  let response = await fetchJson<Record<string, 'read-only' | 'read-write' | 'write'>>(
    `${getNpmRegistryUrl()}/-/org/${encodeURIComponent(normalizedOrg)}/package`
  );

  let packageNames = Object.keys(response).sort();
  let currentPage = packageNames.slice(data.cursor, data.cursor + pageSize);
  if (currentPage.length === 0) return;

  await syncNpmPackageQueue.addManyWithOps(
    currentPage.map(packageName => ({
      data: { packageName },
      opts: {
        id: btoa(packageName),
        delay: 1000 * randomIntBetween(60 * 3, 60 * 7) // Delay because npm's caches can take a bit to update
      }
    }))
  );

  if (data.cursor + pageSize < packageNames.length) {
    let nextCursor = data.cursor + pageSize;
    await syncNpmPackagesQueue.add({ cursor: nextCursor }, { id: `page_${nextCursor}` });
  }
});

let syncNpmPackageQueue = createQueue<{
  packageName: string;
  notFoundAttempt?: number;
}>({
  name: 'sreg/slate/npm/pkg',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5 }
});

export let syncNpmPackageQueueProcessor = syncNpmPackageQueue.process(async data => {
  let metadata: {
    name: string;
    versions?: Record<string, { version: string; dist?: { tarball?: string } }>;
  };

  try {
    metadata = await fetchJson<any>(
      `${getNpmRegistryUrl()}/${encodeURIComponent(data.packageName)}`
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) {
      let notFoundAttempt = (data.notFoundAttempt ?? 0) + 1;

      if (notFoundAttempt > 50) {
        throw new Error(`Package ${data.packageName} not found after 50 attempts`);
      }

      await syncNpmPackageQueue.add(
        { packageName: data.packageName, notFoundAttempt },
        { id: btoa(data.packageName), delay: 1000 * randomIntBetween(60, 60 * 2) }
      );

      return;
    }

    throw error;
  }

  if (metadata.name !== data.packageName) return;

  let existingVersions = new Set(
    (
      await db.slateVersion.findMany({
        where: {
          npmPackageName: data.packageName
        },
        select: {
          version: true
        }
      })
    ).map(version => version.version)
  );

  let versions = Object.values(metadata.versions ?? {})
    .filter(version => version.dist?.tarball && semver.valid(version.version))
    .sort((a, b) => semver.compare(a.version, b.version));

  let newVersions = versions.filter(version => !existingVersions.has(version.version));
  if (newVersions.length === 0) return;

  await syncNpmVersionQueue.addManyWithOps(
    newVersions.map(version => ({
      data: {
        packageName: data.packageName,
        version: version.version,
        tarballUrl: version.dist!.tarball!
      },
      opts: {
        id: `${data.packageName}@${version.version}`
      }
    }))
  );
});

let syncNpmVersionQueue = createQueue<{
  packageName: string;
  version: string;
  tarballUrl: string;
}>({
  name: 'sreg/slate/npm/ver',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 5
  }
});

let syncNpmVersionLock = createLock({
  name: 'sreg/slate/npm/ver/lock',
  redisUrl: env.service.REDIS_URL
});

export let syncNpmVersionQueueProcessor = syncNpmVersionQueue.process(data =>
  syncNpmVersionLock.usingLock(data.packageName, async () => {
    let existingVersion = await db.slateVersion.findFirst({
      where: {
        npmPackageName: data.packageName,
        version: data.version
      },
      select: {
        id: true
      }
    });
    if (existingVersion) return;

    let tarballBuffer = await fetchBuffer(data.tarballUrl);
    let entries = await readTarballEntries(tarballBuffer);
    let slatePackage = normalizeSlatePackage({
      entries,
      identifier: null
    });
    if (slatePackage.npmPackageName !== data.packageName) return;

    let scope = await db.scope.findFirst({
      where: {
        identifier: slatePackage.scopeIdentifier,
        status: 'active'
      },
      include: {
        tenant: true
      }
    });
    if (!scope) {
      let ws = await workspaceService.createWorkspace({
        tenant: await defaultTenant,
        input: {
          name: slatePackage.scopeIdentifier,
          identifier: slatePackage.scopeIdentifier
        }
      });
      scope = await db.scope.findFirstOrThrow({
        where: { oid: ws.scope.oid },
        include: { tenant: true }
      });
    }

    let existingSlateVersion = await db.slateVersion.findFirst({
      where: {
        version: data.version,
        slate: {
          fullIdentifier: slatePackage.fullIdentifier,
          scopeOid: scope.oid,
          tenantOid: scope.tenantOid
        }
      },
      select: {
        id: true
      }
    });
    if (existingSlateVersion) return;

    let slate = await db.slate.findFirst({
      where: {
        identifier: slatePackage.slateIdentifier,
        fullIdentifier: slatePackage.fullIdentifier,
        scopeOid: scope.oid,
        tenantOid: scope.tenantOid
      },
      select: {
        access: true
      }
    });

    let user = await userService.ensureUserByIdentifier({
      identifier: `npm_sync_${scope.identifier}`,
      name: `NPM Sync for ${scope.identifier}`,
      tenant: scope.tenant
    });

    await slateVersionService.publishNormalizedSlateVersion({
      user,
      input: {
        access: slate?.access ?? 'public',
        backend: 'npm',
        bundleBuffer: await createZipBuffer(entries),
        npmPackageName: data.packageName,
        slatePackage
      }
    });
  })
);
