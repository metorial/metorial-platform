import { ensureSecretType } from '@metorial/db';

export let secretTypes = {
  server_instance_config: ensureSecretType(() => ({
    slug: 'server_instance_config',
    name: 'Server Instance Config'
  }))
};

export type SecretType = keyof typeof secretTypes;

export let secretTypeSlugs = Object.keys(secretTypes) as SecretType[];
