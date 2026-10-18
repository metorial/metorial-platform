import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({
    captureException: vi.fn()
  })
}));

vi.mock('@metorial/module-consumer-entities', () => ({
  consumerIntegrationService: {
    findLatestConsumerAuthClientForMagicMcpToken: vi.fn()
  },
  enqueueMaterializeMagicMcpSessionOwnership: vi.fn()
}));

vi.mock('@metorial/module-magic', () => ({
  ensureMagicMcpSubspaceSession: vi.fn(),
  magicMcpEndpointService: {
    checkConsumerReadAccess: vi.fn()
  },
  magicMcpServerService: {
    checkConsumerReadAccess: vi.fn()
  },
  magicMcpTokenService: {
    getMagicMcpTokenBySecret: vi.fn(),
    checkMagicMcpTokenAccess: vi.fn(),
    recordMagicMcpTokenUse: vi.fn()
  },
  resolveMagicMcpTargetByIdOrAlias: vi.fn(),
  resolveMagicMcpTargetByIdOrAliasSafe: vi.fn()
}));

vi.mock('../src/mcp', () => ({
  handleMcpRequest: vi.fn()
}));

// `../src/outpost` only reaches into `@metorial/module-outpost` when an outpost signature is
// actually present, but importing it eagerly initializes Redis-backed caches -- stub it out so
// these unit tests don't need a live Redis/env setup.
vi.mock('@metorial/module-outpost', () => ({
  outpostAccessService: { isServiceGrantedForInstance: vi.fn(async () => true) },
  outpostVerificationTokens: {},
  metorialOutpostResolver: {}
}));

import { consumerIntegrationService } from '@metorial/module-consumer-entities';
import {
  ensureMagicMcpSubspaceSession,
  magicMcpTokenService,
  resolveMagicMcpTargetByIdOrAlias,
  resolveMagicMcpTargetByIdOrAliasSafe
} from '@metorial/module-magic';
import { resolveMagicMcpSubspaceSession } from '../src/magic';

describe('resolveMagicMcpSubspaceSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses a pre-resolved target without resolving it again', async () => {
    let target = {
      type: 'server',
      target: {
        id: 'mms_1',
        oid: 11n,
        instance: {
          id: 'ins_1',
          oid: 22n
        }
      }
    } as any;

    vi.mocked(magicMcpTokenService.getMagicMcpTokenBySecret).mockResolvedValue({
      id: 'mmt_1',
      oid: 33n,
      magicMcpServerOid: 11n,
      magicMcpEndpointOid: null,
      consumerTokens: []
    } as any);
    vi.mocked(magicMcpTokenService.checkMagicMcpTokenAccess).mockResolvedValue(true);
    vi.mocked(magicMcpTokenService.recordMagicMcpTokenUse).mockResolvedValue(undefined);
    vi.mocked(ensureMagicMcpSubspaceSession).mockResolvedValue('backing_session_1');
    vi.mocked(
      consumerIntegrationService.findLatestConsumerAuthClientForMagicMcpToken
    ).mockResolvedValue(null);

    await resolveMagicMcpSubspaceSession({
      magicMcpTarget: target,
      request: new Request('https://api.metorial.test/connect/portal/test?key=secret'),
      url: new URL('https://api.metorial.test/connect/portal/test?key=secret'),
      authenticate: vi.fn() as any
    });

    expect(resolveMagicMcpTargetByIdOrAliasSafe).not.toHaveBeenCalled();
    expect(resolveMagicMcpTargetByIdOrAlias).not.toHaveBeenCalled();
    expect(ensureMagicMcpSubspaceSession).toHaveBeenCalledWith(target);
  });
  it('skips resolving a token-linked server when a target is already resolved', async () => {
    let target = {
      type: 'server',
      target: { id: 'mms_1', oid: 11n, instance: { id: 'ins_1', oid: 22n } }
    } as any;

    vi.mocked(magicMcpTokenService.getMagicMcpTokenBySecret).mockResolvedValue({
      id: 'mmt_1',
      oid: 33n,
      magicMcpServerOid: 44n,
      magicMcpServer: { id: 'mms_2' },
      magicMcpEndpointOid: null,
      magicMcpEndpoint: null,
      consumerTokens: []
    } as any);
    vi.mocked(magicMcpTokenService.checkMagicMcpTokenAccess).mockResolvedValue(true);
    vi.mocked(magicMcpTokenService.recordMagicMcpTokenUse).mockResolvedValue(undefined);
    vi.mocked(ensureMagicMcpSubspaceSession).mockResolvedValue('backing_session_1');

    let res = await resolveMagicMcpSubspaceSession({
      magicMcpTarget: target,
      request: new Request('https://api.metorial.test/connect/portal/test?key=secret'),
      url: new URL('https://api.metorial.test/connect/portal/test?key=secret'),
      authenticate: vi.fn() as any
    });

    expect(resolveMagicMcpTargetByIdOrAlias).not.toHaveBeenCalled();
    expect(res.magicMcpTarget).toBe(target);
    expect(
      consumerIntegrationService.findLatestConsumerAuthClientForMagicMcpToken
    ).not.toHaveBeenCalled();
  });

  it('reuses the token consumer tokens and only loads the latest auth client', async () => {
    let target = {
      type: 'server',
      target: { id: 'mms_1', oid: 11n, instance: { id: 'ins_1', oid: 22n } }
    } as any;
    let consumerProfile = { oid: 55n };

    vi.mocked(magicMcpTokenService.getMagicMcpTokenBySecret).mockResolvedValue({
      id: 'mmt_1',
      oid: 33n,
      magicMcpServerOid: 11n,
      magicMcpEndpointOid: null,
      consumerTokens: [{ id: 'ctk_1', consumerProfile }]
    } as any);
    vi.mocked(magicMcpTokenService.checkMagicMcpTokenAccess).mockResolvedValue(true);
    vi.mocked(magicMcpTokenService.recordMagicMcpTokenUse).mockResolvedValue(undefined);
    vi.mocked(ensureMagicMcpSubspaceSession).mockResolvedValue('backing_session_1');
    vi.mocked(
      consumerIntegrationService.findLatestConsumerAuthClientForMagicMcpToken
    ).mockResolvedValue({
      id: 'cac_1',
      name: 'Client',
      consumerAuthClientSurfaces: []
    } as any);

    let res = await resolveMagicMcpSubspaceSession({
      magicMcpTarget: target,
      request: new Request('https://api.metorial.test/connect/portal/test?key=secret'),
      url: new URL('https://api.metorial.test/connect/portal/test?key=secret'),
      authenticate: vi.fn() as any
    });

    expect(res.consumerProfileForOwnership).toBe(consumerProfile);
    expect(res.agentClient).toEqual({
      name: 'Client',
      type: 'mcp_client_oauth',
      foreignId: 'cac_1',
      oauthRegistrationId: 'cac_1'
    });
  });
});
