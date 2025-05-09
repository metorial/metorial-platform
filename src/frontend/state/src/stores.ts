import { createStorage } from '@metorial/storage';

export let lastProjectIdStore = createStorage<string>('lastProjectId');
