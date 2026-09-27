import { ServiceError, validationError } from '@lowerdeck/error';
import { Hash } from '@lowerdeck/hash';
import { v } from '@lowerdeck/validation';
import { addMinutes } from 'date-fns';
import { hc } from 'hono/client';
import type { Registry } from '../prisma/generated/client';
import { db } from './db';
import { encryption } from './encryption';
import { env } from './env';
import { getId } from './id';

type RegistryClient = {
  slates: any;
  'change-notifications': any;
};

let predefinedRegistrySchema = v.array(
  v.union([
    v.object({
      registryUrl: v.string(),
      name: v.optional(v.string()),
      internalUrl: v.optional(v.string())
    }),
    v.string()
  ])
);

let predefinedRegistryValue: any;

try {
  predefinedRegistryValue = JSON.parse(env.registry.INITIAL_REGISTRIES ?? '[]');
} catch {
  predefinedRegistryValue = env.registry.INITIAL_REGISTRIES?.split(',') || [];
}

let predefinedRegistryRes = predefinedRegistrySchema.validate(predefinedRegistryValue);
if (!predefinedRegistryRes.success) {
  throw new ServiceError(
    validationError({
      message: 'Invalid INITIAL_REGISTRIES value',
      errors: predefinedRegistryRes.errors,
      entity: 'env.INITIAL_REGISTRIES'
    })
  );
}

let predefinedRegistries = predefinedRegistryRes.value.map(r =>
  typeof r === 'string' ? { registryUrl: r } : r
);

let staticRegistryUrl = env.registry.SLATES_REGISTRY_URL;
let staticSubRegistryId = env.registry.SLATES_SUB_REGISTRY_ID;

let effectivePredefinedRegistries: Array<{
  registryUrl: string;
  name?: string;
  internalUrl?: string;
}> = staticRegistryUrl ? [{ registryUrl: staticRegistryUrl }] : predefinedRegistries;

let predefinedRegistryMap = new Map(
  effectivePredefinedRegistries.map(r => [r.registryUrl, r])
);

let ensureStaticRegistry = async (registry: { registryUrl: string }) => {
  let identifier = `reg::default::${await Hash.sha256(JSON.stringify([registry.registryUrl]))}`;
  let name = `Default Registry ${registry.registryUrl}`;

  let existing = await db.registry.findUnique({ where: { identifier } });
  if (existing) {
    if (existing.status !== 'active' || existing.url !== registry.registryUrl) {
      await db.registry.update({
        where: { id: existing.id },
        data: { url: registry.registryUrl, name, status: 'active' }
      });
    }
    return;
  }

  let stale = await db.registry.findMany({
    where: { status: 'active', tenantOid: null, url: { not: registry.registryUrl } },
    orderBy: [{ lastSyncedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }]
  });
  if (stale.length === 0) {
    await upsertRegistry({ registryUrl: registry.registryUrl });
    return;
  }

  let keep = stale[0]!;
  await db.registry.update({
    where: { id: keep.id },
    data: { identifier, url: registry.registryUrl, name, status: 'active' }
  });
  for (let row of stale.slice(1)) {
    await db.registry.update({ where: { id: row.id }, data: { status: 'disabled' } });
  }
};

export let upsertRegistry = async (registry: { registryUrl: string; name?: string }) => {
  let identifier = `reg::default::${await Hash.sha256(JSON.stringify([registry.registryUrl]))}`;
  let name = registry.name ?? `Default Registry ${registry.registryUrl}`;

  await db.registry.upsert({
    where: { identifier },
    update: {
      url: registry.registryUrl,
      name,
      status: 'active',
      isPredefined: true
    },
    create: {
      ...getId('registry'),
      status: 'active',
      isPredefined: true,

      identifier,
      url: registry.registryUrl,
      name
    }
  });
};

if (staticRegistryUrl) {
  await ensureStaticRegistry({ registryUrl: staticRegistryUrl });
} else {
  if (effectivePredefinedRegistries.length === 1) {
    let predefined = await db.registry.findMany({ where: { isPredefined: true } });
    let stale = predefined.filter(r => !predefinedRegistryMap.has(r.url));
    if (predefined.length === 1 && stale.length === 1) {
      let registry = effectivePredefinedRegistries[0]!;
      let identifier = `reg::default::${await Hash.sha256(JSON.stringify([registry.registryUrl]))}`;
      await db.registry.update({
        where: { id: stale[0]!.id },
        data: {
          identifier,
          url: registry.registryUrl,
          name: registry.name ?? `Default Registry ${registry.registryUrl}`,
          status: 'active'
        }
      });
    }
  }

  for (let registry of effectivePredefinedRegistries) {
    await upsertRegistry(registry);
  }
}

let readerToken = new Map<string, { token: Promise<string | null>; expiresAt: number }>();
let getReaderToken = async (registry: Registry) => {
  let current = readerToken.get(registry.id);
  if (current && current.expiresAt > Date.now()) return current.token;

  let prom = await (async () => {
    let reg = predefinedRegistryMap.get(registry.url);
    if (registry.encryptedReaderToken) {
      let value = await encryption.decrypt({
        encrypted: registry.encryptedReaderToken,
        entityId: registry.id
      });
      return value;
    }

    if (reg?.internalUrl) {
      throw new Error('Internal access is not supported');
      // let internalClient = createSlatesRegistryInternalClient({
      //   endpoint: reg.internalUrl
      // });
      // let expiresAt = addMinutes(new Date(), 60);
      // let token = await internalClient.readerToken.create({
      //   expiresAt: addMinutes(expiresAt, 5),
      //   name: `Hub Service ${hubInstanceId}`,
      // });
      // readerToken.set(registry.id, {
      //   token: prom,
      //   expiresAt: expiresAt.getTime()
      // });
      // return token.secret;
    }
  })();

  readerToken.set(registry.id, {
    token: prom,
    expiresAt: addMinutes(new Date(), 5).getTime()
  });

  return prom;
};

export let getRegistryHeaders = (o: { token?: string | null; subRegistryId?: string }) => {
  let headers: Record<string, string> = {};
  if (o.token) headers.Authorization = `Bearer ${o.token}`;
  if (o.subRegistryId) {
    headers['Metorial-Sub-Registry-Id'] = o.subRegistryId;
    headers['Slates-Sub-Registry-Id'] = o.subRegistryId;
  }
  return headers;
};

export let createSlatesRegistryClient = (o: {
  endpoint: string;
  token?: string | null;
  subRegistryId?: string;
}): RegistryClient =>
  hc(o.endpoint, {
    headers: getRegistryHeaders({
      token: o.token,
      subRegistryId: o.subRegistryId ?? staticSubRegistryId
    }),
    init: { redirect: 'follow' }
  }) as unknown as RegistryClient;

export let supportsPrebuiltSlates = () => env.registry.SUPPORTS_PREBUILT_SLATES !== false;

export let getRegistryQuery = () => ({ supports_prebuilt: 'true' as const });

export let getRegistryClient = async (registry: Registry): Promise<RegistryClient> => {
  let token = await getReaderToken(registry);

  return createSlatesRegistryClient({
    endpoint: registry.url,
    token
  });
};
