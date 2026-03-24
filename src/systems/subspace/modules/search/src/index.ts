import { delay } from '@lowerdeck/delay';
import { ProgrammablePromise } from '@lowerdeck/programmable-promise';
import { createVoyagerClient } from '@metorial-services/voyager-client';
import { env } from './env';

let getIndexName = (suffix?: string) =>
  [env.service.VOYAGER_INDEX_PREFIX, 'subspace', suffix].filter(Boolean).join('_');

export let voyager = createVoyagerClient({
  endpoint: env.service.VOYAGER_URL
});

export let voyagerSourceProm = new ProgrammablePromise<
  Awaited<ReturnType<typeof voyager.source.upsert>>
>();
export let voyagerSource = voyagerSourceProm.promise;

(async () => {
  while (true) {
    console.log('Attempting to create source in Voyager...');
    try {
      let voyagerSource = await voyager.source.upsert({
        name: 'Subspace',
        identifier: getIndexName()
      });
      console.log('Successfully created source in Voyager', (await voyagerSource).id);
      voyagerSourceProm.resolve(voyagerSource);
      return;
    } catch (error) {
      console.error('Failed to create source in Voyager, retrying in 5 seconds...', error);
    }

    delay(5000);
  }
})();

export let voyagerIndex = {
  providerListing: await voyager.index.upsert({
    sourceId: (await voyagerSource).id,
    identifier: getIndexName('provider_listing'),
    name: 'Provider Listings'
  }),

  publisher: await voyager.index.upsert({
    sourceId: (await voyagerSource).id,
    identifier: getIndexName('publisher'),
    name: 'Publishers'
  }),

  providerConfig: await voyager.index.upsert({
    sourceId: (await voyagerSource).id,
    identifier: getIndexName('provider_config'),
    name: 'Provider Configs'
  }),

  providerConfigVault: await voyager.index.upsert({
    sourceId: (await voyagerSource).id,
    identifier: getIndexName('provider_config_vault'),
    name: 'Provider Config Vaults'
  }),

  providerDeployment: await voyager.index.upsert({
    sourceId: (await voyagerSource).id,
    identifier: getIndexName('provider_deployment'),
    name: 'Provider Deployments'
  }),

  providerAuthCredentials: await voyager.index.upsert({
    sourceId: (await voyagerSource).id,
    identifier: getIndexName('provider_auth_credentials'),
    name: 'Provider Auth Credentials'
  }),

  providerAuthConfig: await voyager.index.upsert({
    sourceId: (await voyagerSource).id,
    identifier: getIndexName('provider_auth_config'),
    name: 'Provider Auth Configs'
  }),

  customProvider: await voyager.index.upsert({
    sourceId: (await voyagerSource).id,
    identifier: getIndexName('custom_provider'),
    name: 'Custom Providers'
  }),

  identityActor: await voyager.index.upsert({
    sourceId: (await voyagerSource).id,
    identifier: getIndexName('identity_actor'),
    name: 'Identity Actors'
  }),

  agent: await voyager.index.upsert({
    sourceId: (await voyagerSource).id,
    identifier: getIndexName('agent'),
    name: 'Agents'
  }),

  identity: await voyager.index.upsert({
    sourceId: (await voyagerSource).id,
    identifier: getIndexName('identity'),
    name: 'Identities'
  }),

  identityDelegationConfig: await voyager.index.upsert({
    sourceId: (await voyagerSource).id,
    identifier: getIndexName('identity_delegation_config'),
    name: 'Identity Delegation Configs'
  })
};
