import { bindAuditScope } from '@metorial/audit-scope';
import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

let oauthApplicationPayload = (
  oauthApplication: FabricEvents['machine_access.oauth_application.created:after']['oauthApplication'],
  organization: FabricEvents['machine_access.oauth_application.created:after']['organization']
) => ({
  oauthApplication: {
    ...oauthApplication,
    organization
  }
});

let clientSecretPayload = (event: {
  oauthApplication: { id: string; name: string };
  oauthApplicationClientSecret: { id: string; secretPreview: string };
}) => ({
  id: event.oauthApplicationClientSecret.id,
  secretPreview: event.oauthApplicationClientSecret.secretPreview,
  oauthApplication: {
    id: event.oauthApplication.id,
    name: event.oauthApplication.name
  }
});

let authorizationPayload = (event: {
  oauthAuthorization: { id: string; status: string; type: string; scopes: string[] };
  oauthApplication: { id: string; name: string };
}) => ({
  id: event.oauthAuthorization.id,
  status: event.oauthAuthorization.status,
  type: event.oauthAuthorization.type,
  scopes: event.oauthAuthorization.scopes,
  oauthApplication: {
    id: event.oauthApplication.id,
    name: event.oauthApplication.name
  }
});

let authorizationRequestPayload = (event: {
  oauthAuthorizationRequest: { id: string; status: string; type: string; scopes: string[] };
  oauthApplication: { id: string; name: string };
}) => ({
  id: event.oauthAuthorizationRequest.id,
  status: event.oauthAuthorizationRequest.status,
  type: event.oauthAuthorizationRequest.type,
  scopes: event.oauthAuthorizationRequest.scopes,
  oauthApplication: {
    id: event.oauthApplication.id,
    name: event.oauthApplication.name
  }
});

let shouldRecordOAuthApplication = (event: {
  auditScope?: FabricEvents['machine_access.oauth_application.created:after']['auditScope'];
  oauthApplication?: { type: string };
}) =>
  Boolean(event.auditScope) &&
  event.oauthApplication?.type != 'internal' &&
  event.oauthApplication?.type != 'cli_auth';

export let recordOAuthApplicationCreated = async (
  event: FabricEvents['machine_access.oauth_application.created:after']
) => {
  if (!shouldRecordOAuthApplication(event) || !event.auditScope || !event.organization) {
    return;
  }

  let auditScope = bindAuditScope({
    scope: event.auditScope,
    organization: event.organization
  });

  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(auditScope, 'oauth_application', 'create', {
      payload: oauthApplicationPayload(event.oauthApplication, event.organization),
      recordedAt
    });
  });
};

export let recordOAuthApplicationUpdated = async (
  event: FabricEvents['machine_access.oauth_application.updated:after']
) => {
  if (!shouldRecordOAuthApplication(event) || !event.auditScope || !event.organization) {
    return;
  }

  let auditScope = bindAuditScope({
    scope: event.auditScope,
    organization: event.organization
  });

  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(auditScope, 'oauth_application', 'update', {
      payload: oauthApplicationPayload(event.oauthApplication, event.organization),
      previousPayload: oauthApplicationPayload(
        event.previousOAuthApplication,
        event.organization
      ),
      recordedAt
    });
  });
};

export let recordOAuthApplicationArchived = async (
  event: FabricEvents['machine_access.oauth_application.archived:after']
) => {
  if (!shouldRecordOAuthApplication(event) || !event.auditScope || !event.organization) {
    return;
  }

  let auditScope = bindAuditScope({
    scope: event.auditScope,
    organization: event.organization
  });

  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(auditScope, 'oauth_application', 'archive', {
      payload: oauthApplicationPayload(event.oauthApplication, event.organization),
      recordedAt
    });
  });
};

export let recordOAuthApplicationClientSecretCreated = async (
  event: FabricEvents['machine_access.oauth_application.client_secret.create:after']
) => {
  if (!event.auditScope || event.oauthApplication.type == 'internal') return;

  let auditScope = event.auditScope;

  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      auditScope,
      'oauth_application_client_secret',
      'create',
      {
        payload: clientSecretPayload(event),
        recordedAt
      }
    );
  });
};

export let recordOAuthApplicationClientSecretDeleted = async (
  event: FabricEvents['machine_access.oauth_application.client_secret.revoked:after']
) => {
  if (!event.auditScope || event.oauthApplication.type == 'internal') return;

  let auditScope = event.auditScope;

  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      auditScope,
      'oauth_application_client_secret',
      'delete',
      {
        payload: clientSecretPayload(event),
        recordedAt
      }
    );
  });
};

export let recordOAuthInstallationCreated = async (
  event: FabricEvents['machine_access.oauth_installation.created:after']
) => {
  if (!event.auditScope) return;

  let auditScope = event.auditScope;

  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(auditScope, 'oauth_installation', 'create', {
      payload: {
        oauthInstallation: {
          ...event.oauthInstallation,
          organization: event.organization,
          oauthApplication: event.oauthApplication,
          serverSideMachineAccess:
            (event.oauthInstallation as { serverSideMachineAccess?: unknown })
              .serverSideMachineAccess ?? null
        } as any
      },
      recordedAt
    });
  });
};

export let recordOAuthInstallationUpdated = async (
  event: FabricEvents['machine_access.oauth_installation.updated:after']
) => {
  if (!event.auditScope) return;

  let auditScope = event.auditScope;

  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(auditScope, 'oauth_installation', 'update', {
      payload: {
        oauthInstallation: {
          ...event.oauthInstallation,
          organization: event.organization,
          oauthApplication: event.oauthApplication,
          serverSideMachineAccess:
            (event.oauthInstallation as { serverSideMachineAccess?: unknown })
              .serverSideMachineAccess ?? null
        } as any
      },
      previousPayload: {
        oauthInstallation: {
          ...event.previousOAuthInstallation,
          organization: event.organization,
          oauthApplication: event.oauthApplication,
          serverSideMachineAccess:
            (event.previousOAuthInstallation as { serverSideMachineAccess?: unknown })
              .serverSideMachineAccess ?? null
        } as any
      },
      recordedAt
    });
  });
};

export let recordOAuthInstallationRevoked = async (
  event: FabricEvents['machine_access.oauth_installation.revoked:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'oauth_installation', 'revoke', {
      payload: {
        oauthInstallation: {
          ...event.oauthInstallation,
          organization: event.organization,
          oauthApplication: event.oauthApplication,
          serverSideMachineAccess:
            (event.oauthInstallation as { serverSideMachineAccess?: unknown })
              .serverSideMachineAccess ?? null
        } as any
      },
      previousPayload: {
        oauthInstallation: {
          ...event.previousOAuthInstallation,
          organization: event.organization,
          oauthApplication: event.oauthApplication,
          serverSideMachineAccess:
            (event.previousOAuthInstallation as { serverSideMachineAccess?: unknown })
              .serverSideMachineAccess ?? null
        } as any
      },
      recordedAt
    });
  });
};

export let recordOAuthAuthorizationRevoked = async (
  event: FabricEvents['machine_access.oauth_authorization.revoked:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'oauth_authorization', 'revoke', {
      payload: authorizationPayload(event),
      previousPayload: authorizationPayload({
        oauthAuthorization: event.previousOAuthAuthorization,
        oauthApplication: event.oauthApplication
      }),
      recordedAt
    });
  });
};

export let recordOAuthAuthorizationRequestAccepted = async (
  event: FabricEvents['machine_access.oauth_authorization_request.accepted:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'oauth_authorization_request',
      'accept',
      {
        payload: authorizationRequestPayload(event),
        previousPayload: authorizationRequestPayload({
          oauthAuthorizationRequest: event.previousOAuthAuthorizationRequest,
          oauthApplication: event.oauthApplication
        }),
        recordedAt
      }
    );
  });
};

export let recordOAuthAuthorizationRequestDenied = async (
  event: FabricEvents['machine_access.oauth_authorization_request.denied:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'oauth_authorization_request',
      'deny',
      {
        payload: authorizationRequestPayload(event),
        previousPayload: authorizationRequestPayload({
          oauthAuthorizationRequest: event.previousOAuthAuthorizationRequest,
          oauthApplication: event.oauthApplication
        }),
        recordedAt
      }
    );
  });
};

Fabric.listen('machine_access.oauth_application.created:after', recordOAuthApplicationCreated);
Fabric.listen('machine_access.oauth_application.updated:after', recordOAuthApplicationUpdated);
Fabric.listen(
  'machine_access.oauth_application.archived:after',
  recordOAuthApplicationArchived
);
Fabric.listen(
  'machine_access.oauth_application.client_secret.create:after',
  recordOAuthApplicationClientSecretCreated
);
Fabric.listen(
  'machine_access.oauth_application.client_secret.revoked:after',
  recordOAuthApplicationClientSecretDeleted
);
Fabric.listen(
  'machine_access.oauth_installation.created:after',
  recordOAuthInstallationCreated
);
Fabric.listen(
  'machine_access.oauth_installation.updated:after',
  recordOAuthInstallationUpdated
);
Fabric.listen(
  'machine_access.oauth_installation.revoked:after',
  recordOAuthInstallationRevoked
);
Fabric.listen(
  'machine_access.oauth_authorization.revoked:after',
  recordOAuthAuthorizationRevoked
);
Fabric.listen(
  'machine_access.oauth_authorization_request.accepted:after',
  recordOAuthAuthorizationRequestAccepted
);
Fabric.listen(
  'machine_access.oauth_authorization_request.denied:after',
  recordOAuthAuthorizationRequestDenied
);
