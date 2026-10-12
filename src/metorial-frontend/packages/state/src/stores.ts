import { createObjectStorage, createStorage } from '@metorial/storage';

export let lastInstanceIdStore = createStorage<string>('lastInstanceId');

export let lastPortalIdByInstanceStore = createObjectStorage<string>('lastPortalIdByInstance');

export type LastProductPane = 'home' | 'integrations' | 'skills' | 'workforce' | 'developer';

export let lastProductPaneByInstanceStore = createObjectStorage<LastProductPane>(
  'lastProductPaneByInstance'
);
