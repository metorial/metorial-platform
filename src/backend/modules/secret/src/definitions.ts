import { ensureSecretType } from '@metorial/db';

export let secretTypes = {
  server_deployment_config: ensureSecretType(() => ({
    slug: 'server_deployment_config',
    name: 'Server Deployment Config'
  }))
};

export type SecretType = keyof typeof secretTypes;

export let secretTypeSlugs = Object.keys(secretTypes) as SecretType[];
