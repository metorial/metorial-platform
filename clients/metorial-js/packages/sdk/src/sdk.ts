import {
  MetorialFilesEndpoint,
  MetorialInstanceEndpoint,
  MetorialLinksEndpoint,
  MetorialSecretsEndpoint,
  MetorialServerRunErrorsEndpoint,
  MetorialServerRunsEndpoint,
  MetorialServersCapabilitiesEndpoint,
  MetorialServersDeploymentsEndpoint,
  MetorialServersEndpoint,
  MetorialServersImplementationsEndpoint,
  MetorialServersVariantsEndpoint,
  MetorialServersVersionsEndpoint,
  MetorialSessionsEndpoint,
  MetorialSessionsEventsEndpoint,
  MetorialSessionsMessagesEndpoint,
  MetorialSessionsServerSessionsEndpoint
} from '@metorial/generated';
import { MetorialKeyPrefix, sdkBuilder } from './builder';

export let createMetorialSDK = sdkBuilder.build(
  (soft: {
    apiKey: `${MetorialKeyPrefix}${string}` | string;
    apiVersion?: '2025-01-01-pulsar';
    clientSecret?: string;
    asUserId?: string;
    headers?: Record<string, string>;
    apiHost?: string;
  }) => ({
    ...soft,
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
    events: new MetorialSessionsEventsEndpoint(manager),
    messages: new MetorialSessionsMessagesEndpoint(manager),
    serverSessions: new MetorialSessionsServerSessionsEndpoint(manager)
  }),

  files: Object.assign(new MetorialFilesEndpoint(manager), {
    links: new MetorialLinksEndpoint(manager)
  })
}));

export type MetorialSDK = ReturnType<typeof createMetorialSDK>;
