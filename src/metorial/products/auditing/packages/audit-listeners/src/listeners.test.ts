import { beforeEach, describe, expect, it, vi } from 'vitest';

let { recordEvent, addAfterTransactionHook } = vi.hoisted(() => ({
  recordEvent: vi.fn(),
  addAfterTransactionHook: vi.fn(async (hook: () => Promise<void>) => await hook())
}));

vi.mock('@metorial/module-audit-tracker', () => ({
  auditTrackerService: {
    recordEvent
  }
}));

vi.mock('@metorial/db', () => ({
  addAfterTransactionHook
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    listen: vi.fn()
  }
}));

import {
  recordAccessPolicyAssignedToMember,
  recordApiKeyCreated,
  recordApiKeyRevoked,
  recordInstanceCreated,
  recordInstanceUpdated,
  recordOAuthApplicationCreated,
  recordOAuthApplicationUpdated,
  recordOAuthAuthorizationRequestAccepted,
  recordOAuthInstallationRevoked,
  recordOrganizationInitialized,
  recordOrganizationInviteAccepted,
  recordOrganizationMemberCreated,
  recordOrganizationMemberUpdated,
  recordOrganizationUpdated,
  recordProjectBrandUpdated,
  recordProjectCreated,
  recordProjectUpdated,
  recordServiceAccountCreated,
  recordTeamCreated,
  recordTeamMemberAdded,
  recordAuditLogStreamCreated,
  recordAuditLogStreamUpdated,
  recordAuditLogStreamDeleted,
  recordAuditLogStreamPaused,
  recordAuditLogStreamResumed
} from './index';

let organization = { oid: 1n, id: 'org_1' };
let project = { oid: 2n, id: 'prj_1', organization };
let instance = { oid: 3n, id: 'ins_1', organization, project };
let auditScope = {
  organizationOid: organization.oid,
  organizationActorOid: 4n,
  actor: {
    type: 'org_actor' as const,
    id: 'oac_1'
  },
  context: {
    ip: '127.0.0.1'
  }
};

describe('audit Fabric listeners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recordEvent.mockResolvedValue(undefined);
  });

  it('records organization creation and update with the required scope', async () => {
    await recordOrganizationInitialized({ organization, auditScope } as any);
    await recordOrganizationUpdated({
      organization: { ...organization, name: 'Next' },
      previousOrganization: { ...organization, name: 'Previous' },
      auditScope
    } as any);

    expect(recordEvent).toHaveBeenNthCalledWith(
      1,
      auditScope,
      'organization',
      'create',
      expect.objectContaining({
        payload: { organization },
        recordedAt: expect.any(Date)
      })
    );
    expect(recordEvent).toHaveBeenNthCalledWith(
      2,
      auditScope,
      'organization',
      'update',
      expect.objectContaining({
        previousPayload: {
          organization: expect.objectContaining({ name: 'Previous' })
        }
      })
    );
  });

  it('records project creation and update with presenter-ready prior data', async () => {
    await recordProjectCreated({ organization, project, auditScope } as any);
    await recordProjectUpdated({
      organization,
      project: { ...project, name: 'Next' },
      previousProject: { ...project, name: 'Previous' },
      auditScope
    } as any);

    expect(recordEvent).toHaveBeenNthCalledWith(
      1,
      auditScope,
      'project',
      'create',
      expect.objectContaining({ payload: { project } })
    );
    expect(recordEvent).toHaveBeenNthCalledWith(
      2,
      auditScope,
      'project',
      'update',
      expect.objectContaining({
        previousPayload: {
          project: expect.objectContaining({
            name: 'Previous',
            organization
          })
        }
      })
    );
  });

  it('promotes instance events to an instance-linked scope', async () => {
    await recordInstanceCreated({ organization, project, instance, auditScope } as any);
    await recordInstanceUpdated({
      organization,
      project,
      instance: { ...instance, name: 'Next' },
      previousInstance: { ...instance, name: 'Previous' },
      auditScope
    } as any);

    expect(recordEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        organizationOid: 1n,
        instanceOid: 3n,
        organizationActorOid: 4n,
        actor: auditScope.actor,
        context: auditScope.context
      }),
      'instance',
      'create',
      expect.any(Object)
    );
    expect(recordEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        organizationOid: 1n,
        instanceOid: 3n
      }),
      'instance',
      'update',
      expect.objectContaining({
        previousPayload: {
          instance: expect.objectContaining({
            name: 'Previous',
            organization,
            project
          })
        }
      })
    );
  });

  it('isolates audit enqueue failures from the Fabric event', async () => {
    let consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    recordEvent.mockRejectedValueOnce(new Error('Redis unavailable'));

    await expect(
      recordProjectCreated({ organization, project, auditScope } as any)
    ).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      '[Audit] Failed to record audit event after transaction',
      expect.any(Error)
    );

    consoleError.mockRestore();
  });

  it('records organization member and invite lifecycle events', async () => {
    let member = {
      id: 'ome_1',
      organization,
      actor: { id: 'oac_1', teams: [] },
      user: { id: 'usr_1', email: 'a@b.c', name: 'Ada', image: { type: 'default' } }
    };
    let invite = {
      id: 'oin_1',
      organization,
      invitedBy: { id: 'oac_1' },
      status: 'pending'
    };

    await recordOrganizationMemberCreated({ organization, member, auditScope } as any);
    await recordOrganizationMemberUpdated({
      organization,
      member: { ...member, role: 'admin' },
      previousMember: { ...member, role: 'member' },
      auditScope
    } as any);
    await recordOrganizationInviteAccepted({
      organization,
      invite: { ...invite, status: 'accepted' },
      previousInvite: invite,
      auditScope
    } as any);

    expect(recordEvent).toHaveBeenNthCalledWith(
      1,
      auditScope,
      'organization_member',
      'create',
      expect.objectContaining({ payload: { organizationMember: member } })
    );
    expect(recordEvent).toHaveBeenNthCalledWith(
      2,
      auditScope,
      'organization_member',
      'update',
      expect.objectContaining({
        previousPayload: {
          organizationMember: expect.objectContaining({
            role: 'member',
            organization
          })
        }
      })
    );
    expect(recordEvent).toHaveBeenNthCalledWith(
      3,
      auditScope,
      'organization_invite',
      'accept',
      expect.objectContaining({
        previousPayload: {
          organizationInvite: expect.objectContaining({ status: 'pending' })
        }
      })
    );
  });

  it('records team, assignment, and project setting events', async () => {
    let team = { id: 'tm_1', name: 'Support', slug: 'support', organization };
    let actor = { id: 'oac_1', name: 'Ada', email: 'ada@example.com' };
    let member = { id: 'tmm_1' };
    let accessPolicy = { id: 'apl_1', name: 'Support', slug: 'support' };

    await recordTeamCreated({ organization, team, auditScope } as any);
    await recordTeamMemberAdded({ organization, team, actor, member, auditScope } as any);
    await recordAccessPolicyAssignedToMember({
      organization,
      member: { id: 'ome_1' },
      accessPolicy,
      accessPolicyAssignment: { id: 'apa_1' },
      auditScope
    } as any);
    await recordProjectBrandUpdated({
      organization,
      project,
      brand: { id: 'pbr_1', name: 'Next', project },
      previousBrand: { id: 'pbr_1', name: 'Previous', project },
      auditScope
    } as any);

    expect(recordEvent).toHaveBeenNthCalledWith(
      1,
      auditScope,
      'team',
      'create',
      expect.objectContaining({ payload: { team } })
    );
    expect(recordEvent).toHaveBeenNthCalledWith(
      2,
      auditScope,
      'team_member',
      'create',
      expect.objectContaining({
        payload: {
          team: { id: 'tm_1', name: 'Support', slug: 'support' },
          actor: { id: 'oac_1', name: 'Ada', email: 'ada@example.com' },
          member: { id: 'tmm_1' }
        }
      })
    );
    expect(recordEvent).toHaveBeenNthCalledWith(
      3,
      auditScope,
      'access_policy_assignment',
      'create',
      expect.objectContaining({
        payload: expect.objectContaining({
          assignment: { id: 'apa_1' },
          accessPolicy: { id: 'apl_1', name: 'Support', slug: 'support' },
          member: { id: 'ome_1' }
        })
      })
    );
    expect(recordEvent).toHaveBeenNthCalledWith(
      4,
      auditScope,
      'project_brand',
      'update',
      expect.objectContaining({
        previousPayload: {
          projectBrand: expect.objectContaining({ name: 'Previous' })
        }
      })
    );
  });

  it('records machine-access events without secrets and binds instance API keys', async () => {
    let machineAccess = { oid: 5n, instanceOid: instance.oid };
    let apiKey = {
      id: 'apk_1',
      status: 'active',
      type: 'instance_access_token_secret',
      name: 'Prod',
      description: null,
      ipFilters: null,
      expiresAt: null,
      deletedAt: null,
      kind: 'api_key',
      secret: 'never-log-this'
    };
    let oauthApplication = {
      id: 'oap_1',
      name: 'Portal',
      type: 'user_facing',
      organization
    };
    let oauthInstallation = {
      id: 'oin_1',
      organization,
      oauthApplication,
      serverSideMachineAccess: null
    };
    let serviceAccount = {
      id: 'sac_1',
      name: 'CI',
      organization,
      oauthApplication
    };

    await recordApiKeyCreated({
      organization,
      machineAccess,
      apiKey,
      auditScope
    } as any);
    await recordApiKeyRevoked({
      organization,
      machineAccess,
      apiKey: { ...apiKey, status: 'deleted' },
      previousApiKey: apiKey,
      auditScope
    } as any);
    await recordOAuthApplicationCreated({
      organization,
      oauthApplication,
      auditScope
    } as any);
    await recordOAuthApplicationUpdated({
      organization,
      oauthApplication: { ...oauthApplication, name: 'Next' },
      previousOAuthApplication: oauthApplication,
      auditScope
    } as any);
    await recordOAuthInstallationRevoked({
      organization,
      oauthApplication,
      oauthInstallation: { ...oauthInstallation, status: 'revoked' },
      previousOAuthInstallation: oauthInstallation,
      auditScope
    } as any);
    await recordOAuthAuthorizationRequestAccepted({
      organization,
      oauthApplication,
      oauthAuthorizationRequest: {
        id: 'oar_1',
        status: 'accepted',
        type: 'authorization_code',
        scopes: ['organization:read'],
        redirect_url: 'https://example.com/callback?code=secret'
      },
      previousOAuthAuthorizationRequest: {
        id: 'oar_1',
        status: 'pending',
        type: 'authorization_code',
        scopes: ['organization:read']
      },
      auditScope
    } as any);
    await recordServiceAccountCreated({
      organization,
      serviceAccount,
      oauthApplication,
      auditScope
    } as any);

    expect(recordEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        organizationOid: 1n,
        instanceOid: 3n
      }),
      'api_key',
      'create',
      expect.objectContaining({
        payload: expect.not.objectContaining({ secret: 'never-log-this' })
      })
    );
    expect(recordEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ instanceOid: 3n }),
      'api_key',
      'delete',
      expect.any(Object)
    );
    expect(recordEvent).toHaveBeenNthCalledWith(
      3,
      auditScope,
      'oauth_application',
      'create',
      expect.objectContaining({
        payload: {
          oauthApplication: expect.objectContaining({ id: 'oap_1', organization })
        }
      })
    );
    expect(recordEvent).toHaveBeenNthCalledWith(
      4,
      auditScope,
      'oauth_application',
      'update',
      expect.objectContaining({
        previousPayload: {
          oauthApplication: expect.objectContaining({ name: 'Portal' })
        }
      })
    );
    expect(recordEvent).toHaveBeenNthCalledWith(
      5,
      auditScope,
      'oauth_installation',
      'revoke',
      expect.any(Object)
    );
    expect(recordEvent).toHaveBeenNthCalledWith(
      6,
      auditScope,
      'oauth_authorization_request',
      'accept',
      expect.objectContaining({
        payload: expect.not.objectContaining({
          redirect_url: 'https://example.com/callback?code=secret'
        })
      })
    );
    expect(recordEvent).toHaveBeenNthCalledWith(
      7,
      auditScope,
      'service_account',
      'create',
      expect.objectContaining({
        payload: { serviceAccount }
      })
    );
  });

  it('skips machine-access events without an audit scope', async () => {
    await recordOAuthApplicationCreated({
      organization: null,
      oauthApplication: { id: 'oap_global', type: 'user_facing' },
      auditScope: null
    } as any);

    expect(recordEvent).not.toHaveBeenCalled();
  });

  it('records audit log stream create, update, delete, pause, and resume without secrets', async () => {
    let auditLogStream = {
      id: 'als_1',
      provider: 'datadog',
      status: 'active',
      accessStatus: 'ok',
      isPausedDueToError: false,
      errorMessage: null,
      consecutiveErrorCount: 0,
      isStarted: true,
      providerDataRedacted: { site: 'datadoghq.eu' },
      encryptedProviderData: 'secret',
      createdAt: new Date('2026-08-13T10:00:00.000Z'),
      updatedAt: new Date('2026-08-13T10:05:00.000Z')
    };
    let pausedStream = {
      ...auditLogStream,
      accessStatus: 'error',
      isPausedDueToError: true,
      errorMessage: 'delivery failed',
      consecutiveErrorCount: 100
    };

    await recordAuditLogStreamCreated({
      organization,
      auditScope,
      auditLogStream,
      input: { provider: 'datadog' }
    } as any);
    await recordAuditLogStreamUpdated({
      organization,
      auditScope,
      auditLogStream: { ...auditLogStream, status: 'inactive' },
      previousAuditLogStream: auditLogStream,
      input: { status: 'inactive' }
    } as any);
    await recordAuditLogStreamDeleted({
      organization,
      auditScope,
      auditLogStream
    } as any);
    await recordAuditLogStreamPaused({
      organization,
      auditScope,
      auditLogStream: pausedStream,
      previousAuditLogStream: auditLogStream
    } as any);
    await recordAuditLogStreamResumed({
      organization,
      auditScope,
      auditLogStream,
      previousAuditLogStream: pausedStream
    } as any);

    expect(recordEvent).toHaveBeenNthCalledWith(
      1,
      auditScope,
      'audit_log_stream',
      'create',
      expect.objectContaining({
        payload: expect.objectContaining({
          id: 'als_1',
          provider: 'datadog',
          providerDataRedacted: { site: 'datadoghq.eu' }
        })
      })
    );
    expect(recordEvent.mock.calls[0][3].payload).not.toHaveProperty('encryptedProviderData');
    expect(recordEvent).toHaveBeenNthCalledWith(
      2,
      auditScope,
      'audit_log_stream',
      'update',
      expect.objectContaining({
        previousPayload: expect.objectContaining({ status: 'active' })
      })
    );
    expect(recordEvent).toHaveBeenNthCalledWith(
      3,
      auditScope,
      'audit_log_stream',
      'delete',
      expect.objectContaining({
        payload: expect.objectContaining({ id: 'als_1' })
      })
    );
    expect(recordEvent).toHaveBeenNthCalledWith(
      4,
      auditScope,
      'audit_log_stream',
      'pause',
      expect.objectContaining({
        payload: expect.objectContaining({ isPausedDueToError: true }),
        previousPayload: expect.objectContaining({ isPausedDueToError: false })
      })
    );
    expect(recordEvent).toHaveBeenNthCalledWith(
      5,
      auditScope,
      'audit_log_stream',
      'resume',
      expect.objectContaining({
        payload: expect.objectContaining({ isPausedDueToError: false })
      })
    );
  });
});

