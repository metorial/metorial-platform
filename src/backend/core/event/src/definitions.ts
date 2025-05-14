import {
  File,
  FilePurpose,
  Secret,
  Server,
  ServerDeployment,
  ServerInstance,
  ServerVariant
} from '@metorial/db';

export type EventTypesFilePayload = {
  file: File & { purpose: FilePurpose };
};
export type EventTypesServerInstancePayload = {
  serverInstance: ServerInstance & { server: Server; serverVariant: ServerVariant };
};
export type EventTypesServerDeploymentPayload = {
  serverDeployment: ServerDeployment & {
    serverInstance: ServerInstance & { server: Server; serverVariant: ServerVariant };
    server: Server;
    configSecret: Secret;
  };
};

export type EventTypes = {
  // 'file:created': EventTypesFilePayload;
  // 'file:updated': EventTypesFilePayload;
  // 'file:deleted': EventTypesFilePayload;

  'server.server_instance:created': EventTypesServerInstancePayload;
  'server.server_instance:updated': EventTypesServerInstancePayload;
  'server.server_instance:deleted': EventTypesServerInstancePayload;

  'server.server_deployment:created': EventTypesServerDeploymentPayload;
  'server.server_deployment:updated': EventTypesServerDeploymentPayload;
  'server.server_deployment:deleted': EventTypesServerDeploymentPayload;
};
