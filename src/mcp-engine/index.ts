export { Empty } from './ts-proto-gen/common';
export { LauncherConfig } from './ts-proto-gen/launcher';
export {
  ContainerRunConfigWithLauncher,
  CreateSessionRequest,
  CreateSessionRequest_MetadataEntry,
  CreateSessionResponse,
  DiscardSessionRequest,
  DiscardSessionResponse,
  EngineSession,
  EngineSessionError,
  EngineSessionError_MetadataEntry,
  EngineSessionEvent,
  EngineSessionEvent_MetadataEntry,
  EngineSessionMessage,
  EngineSessionMessage_MetadataEntry,
  EngineSessionRun,
  GetErrorRequest,
  GetErrorResponse,
  GetEventRequest,
  GetEventResponse,
  GetMessageRequest,
  GetMessageResponse,
  GetRunRequest,
  GetRunResponse,
  GetServerInfoRequest,
  GetSessionRequest,
  GetSessionResponse,
  ListPagination,
  ListRecentlyActiveRunsRequest,
  ListRecentlyActiveRunsResponse,
  ListRecentlyActiveSessionsRequest,
  ListRecentlyActiveSessionsResponse,
  ListRunErrorsRequest,
  ListRunErrorsResponse,
  ListRunEventsRequest,
  ListRunEventsResponse,
  ListRunMessagesRequest,
  ListRunMessagesResponse,
  ListRunsRequest,
  ListRunsResponse,
  ListSessionErrorsRequest,
  ListSessionErrorsResponse,
  ListSessionEventsRequest,
  ListSessionEventsResponse,
  ListSessionMessagesRequest,
  ListSessionMessagesResponse,
  ListSessionsRequest,
  ListSessionsResponse,
  ListWorkersRequest,
  ListWorkersResponse,
  McpManagerClient,
  RemoteRunConfigWithLauncher,
  SendMcpMessageRequest,
  SendMcpMessageResponse,
  SessionConfig,
  SessionEvent,
  SessionEventInfoRun,
  SessionEventInfoSession,
  SessionEventStartRun,
  SessionEventStopRun,
  StreamMcpMessagesRequest,
  StreamMcpMessagesResponse,
  WorkerInfo
} from './ts-proto-gen/manager';
export {
  McpError,
  McpMessage,
  McpMessageRaw,
  McpMessageType,
  McpOutput,
  McpParticipant
} from './ts-proto-gen/mcp';
export { RunConfig as RemoteRunConfig, RunConfigRemoteServer } from './ts-proto-gen/remote';
export { RunConfigContainer, RunConfig as RunnerRunConfig } from './ts-proto-gen/runner';
export { ListManagersRequest, ListManagersResponse } from './ts-proto-gen/workerBroker';

import { ChannelCredentials, type ChannelOptions } from '@grpc/grpc-js';
import { createChannel, createClient, type Client } from 'nice-grpc';
import { McpManagerService } from './ts-proto-gen/manager';

export let createManagerClient = (opts: {
  host: string;
  credentials?: ChannelCredentials;
  options?: ChannelOptions;
}) => {
  let channel = createChannel(
    opts.host,
    opts.credentials || ChannelCredentials.createInsecure(),
    opts.options || {}
  );

  let client: Client<McpManagerService> = createClient(McpManagerService, channel);

  return client;
};
