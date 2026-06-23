import { createStorage } from '@metorial/storage';

export let lastInstanceIdStore = createStorage<string>('lastInstanceId');
