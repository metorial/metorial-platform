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
let predefinedRegistryMap = new Map(predefinedRegistries.map(r => [r.registryUrl, r]));

export let upsertRegistry = async (registry: { registryUrl: string; name?: string }) => {
  let identifier = `reg::default::${await Hash.sha256(JSON.stringify([registry.registryUrl]))}`;
  await db.registry.upsert({
    where: { identifier },
    update: {
      url: registry.registryUrl,
      status: 'active',
      isPredefined: true
    },
    create: {
      ...getId('registry'),
      status: 'active',
      isPredefined: true,

      identifier,
      url: registry.registryUrl,
      name: registry.name ?? `Default Registry ${registry.registryUrl}`
    }
  });
};

for (let registry of predefinedRegistries) {
  await upsertRegistry(registry);
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

export let createSlatesRegistryClient = (o: {
  endpoint: string;
  token?: string;
}): RegistryClient =>
  hc(o.endpoint, {
    headers: o.token ? { Authorization: `Bearer ${o.token}` } : {},
    init: { redirect: 'follow' }
  }) as unknown as RegistryClient;

export let getRegistryQuery = () =>
  env.registry.SUPPORTS_PREBUILT_SLATES ? { supports_prebuilt: true } : {};

export let getRegistryClient = async (registry: Registry): Promise<RegistryClient> => {
  let token = await getReaderToken(registry);

  return createSlatesRegistryClient({
    endpoint: registry.url,
    token
  });
};
