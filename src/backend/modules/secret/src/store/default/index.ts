import { getConfig } from '@metorial/config';
import { SecretStoreManager } from '../store';
import { SecureEncryption } from './crypto';

let getKey = (secretId: string) => {
  let content = `${getConfig().encryptionSecret}${secretId}`;
  let hash = new Bun.SHA512().update(content).digest('base64');

  let key = hash.substring(0, 45);

  return key;
};

export let defaultSecretStore = SecretStoreManager.create({
  name: 'Default Secret Store',
  slug: 'default_v1',
  encrypt: async (secret, data) => {
    let crypto = new SecureEncryption(getKey(secret.id));

    return await crypto.encrypt(data);
  },
  decrypt: async (secret, data) => {
    let crypto = new SecureEncryption(getKey(secret.id));

    return await crypto.decrypt(data);
  }
});
