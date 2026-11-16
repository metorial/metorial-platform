import { notImplementedError, ServiceError } from '@lowerdeck/error';
import { v, type ValidationTypeValue } from '@lowerdeck/validation';
import {
  createGenesisInternalClient,
  type GenesisInternalClient
} from '@metorial/genesis-client';
import { env } from '../env';

let regionConfigSchema = v.array(
  v.object({
    id: v.string(),
    identifier: v.string(),
    name: v.string(),
    cloud: v.string(),
    area: v.object({ id: v.string(), name: v.string() }),
    genesisUrl: v.string(),
    auth: v.optional(v.object({ audience: v.string() }))
  })
);

export type SandboxRegionConfig = ValidationTypeValue<typeof regionConfigSchema>[number];

let signatureCredentialsSchema = v.object({
  keyId: v.string(),
  privateKey: v.object({
    kty: v.literal('OKP'),
    crv: v.literal('Ed25519'),
    x: v.string(),
    d: v.string()
  })
});

let getSignatureCredentials = (audience: string) => {
  let result = signatureCredentialsSchema.validate(
    JSON.parse(env.genesis.SANDBOX_SIGNATURE_CREDENTIALS ?? '{}')
  );
  if (
    !result.success ||
    !/^[A-Za-z0-9_.:/-]{1,256}$/.test(result.value.keyId) ||
    !/^[A-Za-z0-9_.:/-]{1,256}$/.test(audience) ||
    !/^[A-Za-z0-9_-]{43}$/.test(result.value.privateKey.x) ||
    !/^[A-Za-z0-9_-]{43}$/.test(result.value.privateKey.d)
  ) {
    throw new Error(
      'Authenticated sandbox regions require valid SANDBOX_SIGNATURE_CREDENTIALS'
    );
  }

  return { algorithm: 'ed25519' as const, audience, ...result.value };
};

let configs: SandboxRegionConfig[] | undefined;
let clients = new Map<string, GenesisInternalClient>();

let loadConfigs = (): SandboxRegionConfig[] => {
  if (env.genesis.SANDBOX_REGIONS) {
    let validation = regionConfigSchema.validate(JSON.parse(env.genesis.SANDBOX_REGIONS));
    if (!validation.success) throw new Error('SANDBOX_REGIONS is invalid');

    let ids = new Set(validation.value.map(region => region.id));
    let identifiers = new Set(validation.value.map(region => region.identifier));
    if (ids.size != validation.value.length || identifiers.size != validation.value.length) {
      throw new Error('SANDBOX_REGIONS contains duplicate ids or identifiers');
    }

    for (let region of validation.value) {
      if (region.auth) {
        if (new URL(region.genesisUrl).protocol !== 'https:') {
          throw new Error('Authenticated sandbox regions require HTTPS');
        }
        getSignatureCredentials(region.auth.audience);
      }
    }

    return validation.value;
  }

  if (env.genesis.GENESIS_INTERNAL_URL) {
    return [
      {
        id: 'dev',
        identifier: 'dev',
        name: 'Development',
        cloud: 'Local',
        area: { id: 'dev', name: 'Development' },
        genesisUrl: env.genesis.GENESIS_INTERNAL_URL
      }
    ];
  }

  return [];
};

export let getSandboxRegionConfigs = () => (configs ??= loadConfigs());

export let isSandboxingEnabled = () => getSandboxRegionConfigs().length > 0;

export let getRegionUrl = (regionId: string) => {
  let config = getSandboxRegionConfigs().find(region => region.id == regionId);
  if (!config) {
    throw new ServiceError(
      notImplementedError({ message: `Sandbox region ${regionId} is not configured` })
    );
  }

  return config.genesisUrl;
};

export let getRegionClient = (regionId: string): GenesisInternalClient => {
  let config = getSandboxRegionConfigs().find(region => region.id == regionId);
  if (!config) {
    throw new ServiceError(
      notImplementedError({ message: `Sandbox region ${regionId} is not configured` })
    );
  }

  let client = clients.get(regionId);
  if (!client) {
    client = createGenesisInternalClient(config.genesisUrl, {
      getSignatureCredentials: config.auth
        ? () => getSignatureCredentials(config.auth!.audience)
        : undefined
    });
    clients.set(regionId, client);
  }

  return client;
};
