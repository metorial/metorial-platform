import { defaultSecretStore } from './default';
import { SecretStoreManager } from './store';

let stores = new Map<string, SecretStoreManager>([
  [defaultSecretStore.slug, defaultSecretStore]
]);
let defaultStore = defaultSecretStore.slug;

export let SecretStores = {
  register: (
    manager: SecretStoreManager,
    opts?: {
      isDefault?: boolean;
    }
  ) => {
    stores.set(manager.slug, manager);

    if (opts?.isDefault) SecretStores.setDefault(manager.slug);
  },

  get: (slug: string) => {
    let store = stores.get(slug);
    if (!store) {
      throw new Error(`Secret store with slug ${slug} not found`);
    }

    return store;
  },

  setDefault: (slug: string) => {
    let store = stores.get(slug);
    if (!store) {
      throw new Error(`Secret store with slug ${slug} not found`);
    }

    defaultStore = slug;
  },

  getDefault: () => defaultStore
};
