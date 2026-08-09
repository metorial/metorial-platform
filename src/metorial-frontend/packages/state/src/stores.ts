import { createObjectStorage, createStorage } from '@metorial/storage';

export let lastInstanceIdStore = createStorage<string>('lastInstanceId');

export let lastPortalIdByInstanceStore = createObjectStorage<string>('lastPortalIdByInstance');
