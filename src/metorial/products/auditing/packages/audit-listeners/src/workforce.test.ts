import { beforeEach, describe, expect, it, vi } from 'vitest';

let { recordEvent, recordEvents, addAfterTransactionHook } = vi.hoisted(() => ({
  recordEvent: vi.fn(),
  recordEvents: vi.fn(),
  addAfterTransactionHook: vi.fn(async (hook: () => Promise<void>) => await hook())
}));

vi.mock('@metorial/module-audit-tracker', () => ({
  auditTrackerService: {
    recordEvent,
    recordEvents
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
  recordConsumerGroupUpdated,
  recordConsumerIdentityUpdated,
  recordConsumerInviteUpdated,
  recordConsumerProfileCreated,
  recordConsumerProfileGroupAdded,
  recordConsumerSessionCreated,
  recordConsumerSurfaceCreated
} from './consumer';
import {
  recordConsumerAccessCreated,
  recordConsumerAccessRequestCreated,
  recordConsumerProviderSetupSessionCreated
} from './consumerAccess';
import {
  recordMagicMcpEndpointServersModified,
  recordMagicMcpTokenCreated,
  recordMagicMcpTokenRotated
} from './magicMcp';
import { recordPortalUpdated } from './portal';
import { auditedEmailWhitelistLimit, auditedMessageLimit } from './workforce';

let auditScope = {
  organizationOid: 1n,
  instanceOid: 3n,
  actor: {
    type: 'consumer_profile' as const,
    id: 'cpf_1'
  },
  context: {
    ip: '127.0.0.1'
  }
};

let surface = {
  id: 'csf_1',
  status: 'active',
  type: 'portal',
  name: 'Acme Portal',
  description: null,
  isInternal: false,
  sessionExpiryTimeInSeconds: 3600,
  allowConsumerSkillAuthoring: true,
  allowConsumerSkillPublishing: true,
  emailWhitelist: ['ada@example.com'],
  portal: { id: 'ptl_1' }
};

let consumerProfile = {
  id: 'cpf_1',
  status: 'active',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  inviteStatus: 'accepted',
  aresUserId: 'ares_1',
  ssoGroupIds: ['sso-engineering'],
  ssoRoles: ['admin'],
  consumer: { id: 'con_1', email: 'ada@example.com' },
  surface
};

let consumerGroup = {
  id: 'cgr_1',
  status: 'active',
  type: 'default',
  name: 'Engineering',
  description: null,
  isDefault: false,
  isDefaultEveryoneGroup: false,
  isManaged: false,
  ssoGroupIds: ['sso-engineering']
};

describe('workforce audit listeners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recordEvent.mockResolvedValue(undefined);
    recordEvents.mockResolvedValue(undefined);
  });

  it('records the consumer identity behind the profiles, both sides of a rename', async () => {
    let instanceConsumer = {
      id: 'ico_1',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      isPending: false,
      consumer: {
        id: 'con_1',
        isOrganizationMember: false,
        isPortalConsumer: true,
        isManuallyCreated: true,
        organizationMember: null,
        user: { id: 'usr_1' }
      }
    };

    await recordConsumerIdentityUpdated({
      instanceConsumer: { ...instanceConsumer, name: 'Ada King' },
      previousInstanceConsumer: instanceConsumer,
      auditScope
    } as any);

    let [, resource, action, event] = recordEvent.mock.calls[0]!;
    expect(resource).toBe('consumer');
    expect(action).toBe('update');
    expect(event.payload).toStrictEqual({
      id: 'ico_1',
      consumerId: 'con_1',
      name: 'Ada King',
      email: 'ada@example.com',
      isOrganizationMember: false,
      isPortalConsumer: true,
      isManuallyCreated: true,
      isPending: false,
      organizationMemberId: null,
      userId: 'usr_1'
    });
    expect(event.previousPayload.name).toBe('Ada Lovelace');
  });

  it('records a consumer profile with the SSO claims that produced its access', async () => {
    await recordConsumerProfileCreated({
      consumerProfile,
      surface,
      auditScope
    } as any);

    expect(recordEvent).toHaveBeenCalledWith(
      auditScope,
      'consumer_profile',
      'create',
      expect.objectContaining({
        payload: expect.objectContaining({
          id: 'cpf_1',
          email: 'ada@example.com',
          aresUserId: 'ares_1',
          ssoGroupIds: ['sso-engineering'],
          ssoRoles: ['admin'],
          consumer: { id: 'con_1', email: 'ada@example.com' },
          surface: {
            id: 'csf_1',
            type: 'portal',
            name: 'Acme Portal',
            portalId: 'ptl_1'
          }
        })
      })
    );
  });

  it('separates a manual group assignment from one an SSO assertion produced', async () => {
    await recordConsumerProfileGroupAdded({
      consumerProfile,
      consumerGroup,
      consumerProfileGroup: { assignedVia: 'sso' },
      auditScope
    } as any);

    let [, , , event] = recordEvent.mock.calls[0]!;
    expect(event.payload).toStrictEqual({
      profile: { id: 'cpf_1', email: 'ada@example.com' },
      group: { id: 'cgr_1', name: 'Engineering', isDefault: false },
      assignedVia: 'sso'
    });
  });

  it('records both sides of a consumer group change', async () => {
    await recordConsumerGroupUpdated({
      consumerSurface: surface,
      consumerGroup: { ...consumerGroup, ssoGroupIds: ['sso-engineering', 'sso-ops'] },
      previousConsumerGroup: consumerGroup,
      auditScope
    } as any);

    let [, , , event] = recordEvent.mock.calls[0]!;
    expect(event.payload.ssoGroupIds).toStrictEqual(['sso-engineering', 'sso-ops']);
    expect(event.previousPayload.ssoGroupIds).toStrictEqual(['sso-engineering']);
    expect(event.payload.surfaceId).toBe('csf_1');
  });

  it('caps a long surface email whitelist and says it did', async () => {
    let emailWhitelist = Array.from(
      { length: auditedEmailWhitelistLimit + 5 },
      (_, index) => `person-${index}@example.com`
    );

    await recordConsumerSurfaceCreated({
      organization: {},
      instance: {},
      consumerSurface: { ...surface, emailWhitelist },
      auditScope
    } as any);

    let [, , , event] = recordEvent.mock.calls[0]!;
    expect(event.payload.emailWhitelist).toHaveLength(auditedEmailWhitelistLimit);
    expect(event.payload.emailWhitelistCount).toBe(emailWhitelist.length);
    expect(event.payload.emailWhitelistTruncated).toBe(true);
  });

  it('records where a consumer signed in from, never the session token', async () => {
    await recordConsumerSessionCreated({
      consumerSession: {
        id: 'cse_1',
        tokenNonce: 'secret-nonce',
        ip: '203.0.113.4',
        ua: 'Chrome',
        expiresAt: new Date(0),
        loggedOutAt: null,
        consumerProfile
      },
      auditScope
    } as any);

    let [, , , event] = recordEvent.mock.calls[0]!;
    expect(event.payload).toStrictEqual({
      id: 'cse_1',
      consumerProfileId: 'cpf_1',
      consumerProfileEmail: 'ada@example.com',
      surfaceId: 'csf_1',
      portalId: 'ptl_1',
      ip: '203.0.113.4',
      ua: 'Chrome',
      expiresAt: new Date(0),
      loggedOutAt: null
    });
    expect(JSON.stringify(event.payload)).not.toContain('secret-nonce');
  });

  it('skips an invite update that no request is behind', async () => {
    await recordConsumerInviteUpdated({
      consumerInvite: { id: 'cin_1', status: 'accepted' },
      consumerProfile,
      consumerSurface: surface
    } as any);

    expect(recordEvent).not.toHaveBeenCalled();
  });

  it('records the portal redirect allowlist so widening it is visible', async () => {
    let portal = {
      id: 'ptl_1',
      status: 'active',
      name: 'Acme Portal',
      slug: 'acme',
      description: null,
      isDefaultPortal: false,
      surface: { id: 'csf_1' },
      allowedRedirectUrlFilters: [{ url: 'https://acme.example.com/*' }]
    };

    await recordPortalUpdated({
      portal: { ...portal, allowedRedirectUrlFilters: [{ url: 'https://*/*' }] },
      previousPortal: portal,
      auditScope
    } as any);

    let [, , , event] = recordEvent.mock.calls[0]!;
    expect(event.payload.allowedRedirectUrlFilters).toStrictEqual(['https://*/*']);
    expect(event.previousPayload.allowedRedirectUrlFilters).toStrictEqual([
      'https://acme.example.com/*'
    ]);
  });

  it('names both sides of a grant and sizes the listing readme', async () => {
    await recordConsumerAccessCreated({
      consumerAccess: {
        id: 'cac_1',
        type: 'magic_mcp_server',
        accessLevel: null,
        surface: { id: 'csf_1' },
        consumerGroup,
        magicMcpServer: { id: 'mms_1', name: 'Jira' },
        providerTemplate: null,
        skill: null,
        skillTemplate: null,
        skillGroup: null,
        skillMarketplace: null,
        skillPlugin: null,
        listing: {
          id: 'cal_1',
          name: 'Jira',
          description: 'Issue tracker',
          readme: 'hello'
        }
      },
      auditScope
    } as any);

    let [, , , event] = recordEvent.mock.calls[0]!;
    expect(event.payload.target).toStrictEqual({
      type: 'magic_mcp_server',
      id: 'mms_1',
      name: 'Jira'
    });
    expect(event.payload.consumerGroup).toStrictEqual({
      id: 'cgr_1',
      name: 'Engineering',
      type: 'default'
    });
    expect(event.payload.listing.readmeByteSize).toBe(5);
  });

  it('truncates a long access request message and flags it', async () => {
    let message = 'x'.repeat(auditedMessageLimit + 100);

    await recordConsumerAccessRequestCreated({
      consumerAccessRequest: {
        id: 'car_1',
        status: 'pending',
        type: 'provider_template',
        surface: { id: 'csf_1' },
        consumerProfile: { id: 'cpf_1', email: 'ada@example.com' },
        providerTemplate: { id: 'pvt_1', name: 'Jira' },
        magicMcpServer: null,
        message,
        resolutionMessage: null,
        reviewedAt: null
      },
      auditScope
    } as any);

    let [, , , event] = recordEvent.mock.calls[0]!;
    expect(event.payload.message).toHaveLength(auditedMessageLimit);
    expect(event.payload.messageTruncated).toBe(true);
    expect(event.payload.resolutionMessage).toBeNull();
    expect(event.payload.resolutionMessageTruncated).toBe(false);
  });

  it('records a consumer connecting a provider account without any credential', async () => {
    await recordConsumerProviderSetupSessionCreated({
      binding: { id: 'cpss_1' },
      setupSession: { id: 'iss_1' },
      consumerSurface: surface,
      consumerProfile,
      providerTemplate: { id: 'pvt_1', name: 'Jira' },
      auditScope
    } as any);

    let [, , , event] = recordEvent.mock.calls[0]!;
    expect(event.payload).toStrictEqual({
      id: 'cpss_1',
      setupSessionId: 'iss_1',
      surfaceId: 'csf_1',
      consumerProfile: { id: 'cpf_1', email: 'ada@example.com' },
      providerTemplate: { id: 'pvt_1', name: 'Jira' }
    });
  });

  it('never records a magic MCP token secret', async () => {
    let magicMcpToken = {
      id: 'mmt_1',
      status: 'active',
      secret: 'super-secret',
      name: 'CLI',
      description: null,
      isGroupLocked: true,
      expiresAt: null,
      magicMcpServer: { id: 'mms_1' },
      magicMcpEndpoint: null,
      skillPlugin: null,
      groups: [{ magicMcpGroup: { id: 'mmg_1' } }]
    };

    await recordMagicMcpTokenCreated({ instance: {}, magicMcpToken, auditScope } as any);
    await recordMagicMcpTokenRotated({ magicMcpToken, auditScope } as any);

    for (let [, , action, event] of recordEvent.mock.calls) {
      expect(JSON.stringify(event.payload)).not.toContain('super-secret');
      expect(event.payload.groupIds).toStrictEqual(['mmg_1']);
      expect(['create', 'rotate']).toContain(action);
    }
  });

  it('records only the servers an endpoint actually gained', async () => {
    await recordMagicMcpEndpointServersModified({
      magicMcpEndpoint: { id: 'mme_1', slug: 'acme-endpoint' },
      operation: 'add',
      servers: [{ id: 'mms_1', name: 'Jira' }],
      auditScope
    } as any);

    let [, resource, action, event] = recordEvent.mock.calls[0]!;
    expect(resource).toBe('magic_mcp_endpoint_servers');
    expect(action).toBe('modify');
    expect(event.payload).toStrictEqual({
      endpointId: 'mme_1',
      endpointSlug: 'acme-endpoint',
      operation: 'add',
      servers: [{ id: 'mms_1', name: 'Jira' }]
    });
  });

  it('writes nothing when a server membership request changed nothing', async () => {
    await recordMagicMcpEndpointServersModified({
      magicMcpEndpoint: { id: 'mme_1', slug: 'acme-endpoint' },
      operation: 'add',
      servers: [],
      auditScope
    } as any);

    expect(recordEvent).not.toHaveBeenCalled();
  });
});
