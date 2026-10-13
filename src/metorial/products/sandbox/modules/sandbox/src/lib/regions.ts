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
    genesisUrl: v.string()
  })
);

export type SandboxRegionConfig = ValidationTypeValue<typeof regionConfigSchema>[number];

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

export let getRegionClient = (regionId: string): GenesisInternalClient => {
  let config = getSandboxRegionConfigs().find(region => region.id == regionId);
  if (!config) {
    throw new ServiceError(
      notImplementedError({ message: `Sandbox region ${regionId} is not configured` })
    );
  }

  let client = clients.get(regionId);
  if (!client) {
    client = createGenesisInternalClient(config.genesisUrl);
    clients.set(regionId, client);
  }

  return client;
};
