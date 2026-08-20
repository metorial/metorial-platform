import {
  Encryption,
  parseSupportedEncryptionAadVersions,
  VersionedEncryptionKeyring
} from '@lowerdeck/encryption';
import { env } from './env';

export let encryption = new Encryption(env.encryption.ENCRYPTION_KEY);

type HubEncryptionConfig = {
  ENCRYPTION_KEY: string;
  ENCRYPTION_KEYRING_JSON?: string;
  ENCRYPTION_ACTIVE_KEY_VERSION?: number;
  ENCRYPTION_ACTIVE_AAD_VERSION?: number;
  ENCRYPTION_SUPPORTED_AAD_VERSIONS?: string;
};

export let createHubVersionedEncryptionKeyring = (
  config: HubEncryptionConfig = env.encryption
) => {
  let keys: Record<number, string> = { 1: config.ENCRYPTION_KEY };
  if (config.ENCRYPTION_KEYRING_JSON) {
    let parsed = JSON.parse(config.ENCRYPTION_KEYRING_JSON) as Record<string, unknown>;
    for (let [version, value] of Object.entries(parsed)) {
      if (typeof value !== 'string') throw new Error('Hub encryption keyring is invalid');
      keys[Number(version)] = value;
    }
  }
  let activeAadVersion = config.ENCRYPTION_ACTIVE_AAD_VERSION ?? 1;
  return new VersionedEncryptionKeyring({
    keys,
    activeKeyVersion: config.ENCRYPTION_ACTIVE_KEY_VERSION ?? 1,
    supportedAadVersions: parseSupportedEncryptionAadVersions({
      configured: config.ENCRYPTION_SUPPORTED_AAD_VERSIONS,
      activeAadVersion
    })
  });
};
