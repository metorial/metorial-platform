export * from './sdk';

export type {
  InstanceGetOutput,
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
  MetorialSessionsEndpoint,
  MetorialSessionsEventsEndpoint,
  MetorialSessionsMessagesEndpoint,
  MetorialSessionsServerSessionsEndpoint
} from '@metorial/generated';

import type * as MetorialGenerated from '@metorial/generated';

export namespace MetorialSDK {
  export type SecretsGetOutput = MetorialGenerated.SecretsGetOutput;
  export type Secret = MetorialGenerated.SecretsGetOutput;
  export type SecretsListOutput = MetorialGenerated.SecretsListOutput;
  export type SecretsListQuery = MetorialGenerated.SecretsListQuery;
  export type ServerRunErrorsGetOutput = MetorialGenerated.ServerRunErrorsGetOutput;
  export type ServerRunError = MetorialGenerated.ServerRunErrorsGetOutput;
  export type ServerRunErrorsListOutput = MetorialGenerated.ServerRunErrorsListOutput;
  export type ServerRunErrorsListQuery = MetorialGenerated.ServerRunErrorsListQuery;
  export type ServerRunsGetOutput = MetorialGenerated.ServerRunsGetOutput;
  export type ServerRun = MetorialGenerated.ServerRunsGetOutput;
  export type ServerRunsListOutput = MetorialGenerated.ServerRunsListOutput;
  export type ServerRunsListQuery = MetorialGenerated.ServerRunsListQuery;
  export type ServersCapabilitiesListOutput = MetorialGenerated.ServersCapabilitiesListOutput;
  export type ServerCapabilities = MetorialGenerated.ServersCapabilitiesListOutput;
  export type ServersCapabilitiesListQuery = MetorialGenerated.ServersCapabilitiesListQuery;
  export type ServersDeploymentsCreateBody = MetorialGenerated.ServersDeploymentsCreateBody;
  export type ServersDeploymentsCreateOutput =
    MetorialGenerated.ServersDeploymentsCreateOutput;
  export type ServersDeploymentsDeleteOutput =
    MetorialGenerated.ServersDeploymentsDeleteOutput;
  export type ServersDeploymentsGetOutput = MetorialGenerated.ServersDeploymentsGetOutput;
  export type ServersDeployment = MetorialGenerated.ServersDeploymentsGetOutput;
  export type ServersDeploymentsListOutput = MetorialGenerated.ServersDeploymentsListOutput;
  export type ServersDeploymentsListQuery = MetorialGenerated.ServersDeploymentsListQuery;
  export type ServersDeploymentsUpdateBody = MetorialGenerated.ServersDeploymentsUpdateBody;
  export type ServersDeploymentsUpdateOutput =
    MetorialGenerated.ServersDeploymentsUpdateOutput;
  export type ServersGetOutput = MetorialGenerated.ServersGetOutput;
  export type Server = MetorialGenerated.ServersGetOutput;
  export type ServersImplementationsCreateBody =
    MetorialGenerated.ServersImplementationsCreateBody;
  export type ServersImplementationsCreateOutput =
    MetorialGenerated.ServersImplementationsCreateOutput;
  export type ServersImplementationsDeleteOutput =
    MetorialGenerated.ServersImplementationsDeleteOutput;
  export type ServersImplementationsGetOutput =
    MetorialGenerated.ServersImplementationsGetOutput;
  export type ServersImplementation = MetorialGenerated.ServersImplementationsGetOutput;
  export type ServersImplementationsListOutput =
    MetorialGenerated.ServersImplementationsListOutput;
  export type ServersImplementationsListQuery =
    MetorialGenerated.ServersImplementationsListQuery;
  export type ServersImplementationsUpdateBody =
    MetorialGenerated.ServersImplementationsUpdateBody;
  export type ServersImplementationsUpdateOutput =
    MetorialGenerated.ServersImplementationsUpdateOutput;
  export type ServersVariantsGetOutput = MetorialGenerated.ServersVariantsGetOutput;
  export type ServersVariant = MetorialGenerated.ServersVariantsGetOutput;
  export type ServersVariantsListOutput = MetorialGenerated.ServersVariantsListOutput;
  export type ServersVariantsListQuery = MetorialGenerated.ServersVariantsListQuery;
  export type ServersVersionsGetOutput = MetorialGenerated.ServersVersionsGetOutput;
  export type ServersVersion = MetorialGenerated.ServersVersionsGetOutput;
  export type ServersVersionsListOutput = MetorialGenerated.ServersVersionsListOutput;
  export type ServersVersionsListQuery = MetorialGenerated.ServersVersionsListQuery;
  export type SessionsCreateBody = MetorialGenerated.SessionsCreateBody;
  export type SessionsCreateOutput = MetorialGenerated.SessionsCreateOutput;
  export type SessionsDeleteOutput = MetorialGenerated.SessionsDeleteOutput;
  export type SessionsEventsGetOutput = MetorialGenerated.SessionsEventsGetOutput;
  export type SessionsEvent = MetorialGenerated.SessionsEventsGetOutput;
  export type SessionsEventsListOutput = MetorialGenerated.SessionsEventsListOutput;
  export type SessionsEventsListQuery = MetorialGenerated.SessionsEventsListQuery;
  export type SessionsGetOutput = MetorialGenerated.SessionsGetOutput;
  export type Session = MetorialGenerated.SessionsGetOutput;
  export type SessionsListOutput = MetorialGenerated.SessionsListOutput;
  export type SessionsListQuery = MetorialGenerated.SessionsListQuery;
  export type SessionsMessagesGetOutput = MetorialGenerated.SessionsMessagesGetOutput;
  export type SessionsMessage = MetorialGenerated.SessionsMessagesGetOutput;
  export type SessionsMessagesListOutput = MetorialGenerated.SessionsMessagesListOutput;
  export type SessionsMessagesListQuery = MetorialGenerated.SessionsMessagesListQuery;
  export type SessionsServerSessionsGetOutput =
    MetorialGenerated.SessionsServerSessionsGetOutput;
  export type SessionsServerSession = MetorialGenerated.SessionsServerSessionsGetOutput;
  export type SessionsServerSessionsListOutput =
    MetorialGenerated.SessionsServerSessionsListOutput;
  export type SessionsServerSessionsListQuery =
    MetorialGenerated.SessionsServerSessionsListQuery;
}
