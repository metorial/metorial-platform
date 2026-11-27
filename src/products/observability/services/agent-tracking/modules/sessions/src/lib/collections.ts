import { getStore } from '@mtsrc/agent-tracking-store';

export let collections = async () => {
  let store = getStore();
  await store.ready();

  return store.collections();
};
