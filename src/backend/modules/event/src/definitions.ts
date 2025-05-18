import {
  File,
  FilePurpose,
  Secret,
  Server,
  ServerDeployment,
  ServerDeploymentConfig,
  ServerImplementation,
  ServerSession,
  ServerVariant,
  Session
} from '@metorial/db';

export type EventTypesFilePayload = {
  file: File & { purpose: FilePurpose };
};

export type EventTypesServerImplementationPayload = {
  serverImplementation: ServerImplementation & {
    server: Server;
    serverVariant: ServerVariant;
  };
};

export type EventTypesServerDeploymentPayload = {
  serverDeployment: ServerDeployment & {
    serverImplementation: ServerImplementation & {
      server: Server;
      serverVariant: ServerVariant;
    };
    server: Server;
    config: ServerDeploymentConfig & {
      configSecret: Secret;
    };
  };
};

export type EventTypesSessionPayload = {
  session: Session & {
    serverDeployments: (ServerDeployment & {
      server: Server;
      serverVariant: ServerVariant;
    })[];
    // serverSessions: (ServerSession & {
    //   serverDeployment: ServerDeployment & {
    //     serverVariant: ServerVariant;
    //   };
    // })[];
  };
};

export type EventTypesServerSessionPayload = {
  serverSession: ServerSession & {
    serverDeployment: ServerDeployment & {
      serverVariant: ServerVariant;
    };
  };
  session: Session;
};

export type EventTypes = {
  // 'file:created': EventTypesFilePayload;
  // 'file:updated': EventTypesFilePayload;
  // 'file:deleted': EventTypesFilePayload;

  'server.server_implementation:created': EventTypesServerImplementationPayload;
  'server.server_implementation:updated': EventTypesServerImplementationPayload;
  'server.server_implementation:deleted': EventTypesServerImplementationPayload;

  'server.server_deployment:created': EventTypesServerDeploymentPayload;
  'server.server_deployment:updated': EventTypesServerDeploymentPayload;
  'server.server_deployment:deleted': EventTypesServerDeploymentPayload;

  'session:created': EventTypesSessionPayload;
  'session:updated': EventTypesSessionPayload;
  'session:deleted': EventTypesSessionPayload;

  'session.server_session:created': EventTypesServerSessionPayload;
};
