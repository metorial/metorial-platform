import { ensureSecretType } from '@metorial/db';

export let secretTypes = {
  server_deployment_config: ensureSecretType(() => ({
    slug: 'server_deployment_config',
    name: 'Server Deployment Config'
  })),

  server_config_vault: ensureSecretType(() => ({
    slug: 'server_config_vault',
    name: 'Server Config Vault'
  })),

  server_deployment_template_config: ensureSecretType(() => ({
    slug: 'server_deployment_template_config',
    name: 'Server Deployment Template Config'
  }))
};

export type SecretType = keyof typeof secretTypes;

export let secretTypeSlugs = Object.keys(secretTypes) as SecretType[];
