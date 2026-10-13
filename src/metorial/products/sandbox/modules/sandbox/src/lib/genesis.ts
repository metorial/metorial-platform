import { notImplementedError, ServiceError } from '@lowerdeck/error';
import {
  createGenesisInternalClient,
  type GenesisInternalClient
} from '@metorial/genesis-client';
import { env } from '../env';

let client: GenesisInternalClient | undefined;

export let isSandboxingEnabled = () => !!env.genesis.GENESIS_INTERNAL_URL;

export let getGenesis = (): GenesisInternalClient => {
  if (!env.genesis.GENESIS_INTERNAL_URL) {
    throw new ServiceError(
      notImplementedError({
        message: 'Sandboxing is not enabled on this Metorial installation.'
      })
    );
  }

  client ??= createGenesisInternalClient(env.genesis.GENESIS_INTERNAL_URL);
  return client;
};
