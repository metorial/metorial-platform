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
  MetorialSessionsConnectionsEndpoint,
  MetorialSessionsEndpoint,
  MetorialSessionsMessagesEndpoint
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
  export type ServerCapabilitiesListOutput = MetorialGenerated.ServersCapabilitiesListOutput;
  export type ServerCapabilities = MetorialGenerated.ServersCapabilitiesListOutput;
  export type ServerCapabilitiesListQuery = MetorialGenerated.ServersCapabilitiesListQuery;
  export type ServerDeploymentsCreateBody = MetorialGenerated.ServersDeploymentsCreateBody;
  export type ServerDeploymentsCreateOutput = MetorialGenerated.ServersDeploymentsCreateOutput;
  export type ServerDeploymentsDeleteOutput = MetorialGenerated.ServersDeploymentsDeleteOutput;
  export type ServerDeploymentsGetOutput = MetorialGenerated.ServersDeploymentsGetOutput;
  export type ServerDeployment = MetorialGenerated.ServersDeploymentsGetOutput;
  export type ServerDeploymentsListOutput = MetorialGenerated.ServersDeploymentsListOutput;
  export type ServerDeploymentsListQuery = MetorialGenerated.ServersDeploymentsListQuery;
  export type ServerDeploymentsUpdateBody = MetorialGenerated.ServersDeploymentsUpdateBody;
  export type ServerDeploymentsUpdateOutput = MetorialGenerated.ServersDeploymentsUpdateOutput;
  export type ServersGetOutput = MetorialGenerated.ServersGetOutput;
  export type Server = MetorialGenerated.ServersGetOutput;
  export type ServerImplementationsCreateBody =
    MetorialGenerated.ServersImplementationsCreateBody;
  export type ServerImplementationsCreateOutput =
    MetorialGenerated.ServersImplementationsCreateOutput;
  export type ServerImplementationsDeleteOutput =
    MetorialGenerated.ServersImplementationsDeleteOutput;
  export type ServerImplementationsGetOutput =
    MetorialGenerated.ServersImplementationsGetOutput;
  export type ServersImplementation = MetorialGenerated.ServersImplementationsGetOutput;
  export type ServerImplementationsListOutput =
    MetorialGenerated.ServersImplementationsListOutput;
  export type ServerImplementationsListQuery =
    MetorialGenerated.ServersImplementationsListQuery;
  export type ServerImplementationsUpdateBody =
    MetorialGenerated.ServersImplementationsUpdateBody;
  export type ServerImplementationsUpdateOutput =
    MetorialGenerated.ServersImplementationsUpdateOutput;
  export type ServerVariantsGetOutput = MetorialGenerated.ServersVariantsGetOutput;
  export type ServerVariant = MetorialGenerated.ServersVariantsGetOutput;
  export type ServerVariantsListOutput = MetorialGenerated.ServersVariantsListOutput;
  export type ServerVariantsListQuery = MetorialGenerated.ServersVariantsListQuery;
  export type ServerVersionsGetOutput = MetorialGenerated.ServersVersionsGetOutput;
  export type ServerVersion = MetorialGenerated.ServersVersionsGetOutput;
  export type ServerVersionsListOutput = MetorialGenerated.ServersVersionsListOutput;
  export type ServerVersionsListQuery = MetorialGenerated.ServersVersionsListQuery;
  export type SessionsCreateBody = MetorialGenerated.SessionsCreateBody;
  export type SessionsCreateOutput = MetorialGenerated.SessionsCreateOutput;
  export type SessionsDeleteOutput = MetorialGenerated.SessionsDeleteOutput;
  export type SessionsGetOutput = MetorialGenerated.SessionsGetOutput;
  export type Session = MetorialGenerated.SessionsGetOutput;
  export type SessionsListOutput = MetorialGenerated.SessionsListOutput;
  export type SessionsListQuery = MetorialGenerated.SessionsListQuery;
  export type SessionMessagesGetOutput = MetorialGenerated.SessionsMessagesGetOutput;
  export type SessionMessage = MetorialGenerated.SessionsMessagesGetOutput;
  export type SessionMessagesListOutput = MetorialGenerated.SessionsMessagesListOutput;
  export type SessionMessagesListQuery = MetorialGenerated.SessionsMessagesListQuery;
  export type SessionConnectionsGetOutput = MetorialGenerated.SessionsConnectionsGetOutput;
  export type SessionServerSession = MetorialGenerated.SessionsConnectionsGetOutput;
  export type SessionConnectionsListOutput = MetorialGenerated.SessionsConnectionsListOutput;
  export type SessionConnectionsListQuery = MetorialGenerated.SessionsConnectionsListQuery;
}
