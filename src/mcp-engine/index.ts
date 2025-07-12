export { Empty } from './ts-proto-gen/common';
export { LauncherConfig, LauncherConfig_LauncherType } from './ts-proto-gen/launcher';
export {
  ContainerRunConfigWithLauncher,
  CreateSessionRequest,
  CreateSessionRequest_MetadataEntry,
  CreateSessionResponse,
  DiscardSessionRequest,
  DiscardSessionResponse,
  EngineRunStatus,
  EngineRunType,
  EngineSession,
  EngineSessionError,
  EngineSessionError_MetadataEntry,
  EngineSessionEvent,
  EngineSessionEvent_MetadataEntry,
  EngineSessionEventType,
  EngineSessionMessage,
  EngineSessionMessage_MetadataEntry,
  EngineSessionRun,
  EngineSessionStatus,
  EngineSessionType,
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
  ListPaginationOrder,
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
  RemoteRunConfigWithLauncher,
  SendMcpMessageRequest,
  SendMcpMessageResponse,
  SessionConfig,
  SessionEvent,
  SessionEventInfoRun,
  SessionEventInfoSession,
  SessionEventStartRun,
  SessionEventStopRun,
  SessionMessageSender,
  StreamMcpMessagesRequest,
  StreamMcpMessagesResponse,
  WorkerInfo
} from './ts-proto-gen/manager';
export {
  McpError,
  McpError_McpErrorCode,
  McpMessage,
  McpMessageRaw,
  McpMessageType,
  McpOutput,
  McpOutput_McpOutputType,
  McpParticipant,
  McpParticipant_ParticipantType
} from './ts-proto-gen/mcp';
export {
  RunConfig as RemoteRunConfig,
  RunConfigRemoteServer,
  RunConfigRemoteServer_ServerProtocol
} from './ts-proto-gen/remote';
export { RunConfigContainer, RunConfig as RunnerRunConfig } from './ts-proto-gen/runner';
export { ListManagersRequest, ListManagersResponse } from './ts-proto-gen/workerBroker';

import { ChannelCredentials, type ChannelOptions } from '@grpc/grpc-js';
import { createChannel, createClient, type Client } from 'nice-grpc';
import { McpManagerService } from './ts-proto-gen/manager';

export let createManagerClient = (opts: {
  address: string;
  credentials?: ChannelCredentials;
  options?: ChannelOptions;
}) => {
  let channel = createChannel(
    opts.address,
    opts.credentials || ChannelCredentials.createInsecure(),
    opts.options || {}
  );

  let client: Client<McpManagerService> = createClient(McpManagerService, channel);

  return client;
};

export type McpManagerClient = Client<McpManagerService>;
