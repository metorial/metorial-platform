import {
  MetorialInstanceEndpoint,
  MetorialSecretsEndpoint,
  MetorialServerRunErrorsEndpoint,
  MetorialServerRunsEndpoint,
  MetorialServersCapabilitiesEndpoint,
  MetorialServersDeploymentsEndpoint,
  MetorialServersEndpoint,
  MetorialServersImplementationsEndpoint,
  MetorialServersVariantsEndpoint,
  MetorialServersVersionsEndpoint,
  MetorialSessionsConnectionsEndpoint,
  MetorialSessionsEndpoint,
  MetorialSessionsMessagesEndpoint
} from '@metorial/generated';
import { MetorialKeyPrefix, sdkBuilder } from './builder';

export let createMetorialCoreSDK = sdkBuilder.build(
  (soft: {
    apiKey: `${MetorialKeyPrefix}${string}` | string;
    apiVersion?: '2025-01-01-pulsar';
    headers?: Record<string, string>;
    apiHost?: string;
    mcpHost?: string;
  }) => ({
    ...soft,
    apiHost: soft.apiHost,
    mcpHost: soft.mcpHost ?? soft.apiHost,
    apiVersion: '2025-01-01-pulsar'
  })
)(manager => ({
  instance: new MetorialInstanceEndpoint(manager),

  secrets: new MetorialSecretsEndpoint(manager),

  servers: Object.assign(new MetorialServersEndpoint(manager), {
    variants: new MetorialServersVariantsEndpoint(manager),
    versions: new MetorialServersVersionsEndpoint(manager),

    deployments: new MetorialServersDeploymentsEndpoint(manager),
    implementations: new MetorialServersImplementationsEndpoint(manager),

    errors: Object.assign(new MetorialServerRunErrorsEndpoint(manager)),

    runs: new MetorialServerRunsEndpoint(manager),

    capabilities: new MetorialServersCapabilitiesEndpoint(manager)
  }),

  sessions: Object.assign(new MetorialSessionsEndpoint(manager), {
    messages: new MetorialSessionsMessagesEndpoint(manager),
    connections: new MetorialSessionsConnectionsEndpoint(manager)
  })

  // files: Object.assign(new MetorialFilesEndpoint(manager), {
  //   links: new MetorialLinksEndpoint(manager)
  // })
}));

export type MetorialCoreSDK = ReturnType<typeof createMetorialCoreSDK>;
