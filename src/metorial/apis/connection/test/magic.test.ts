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
  createSkillEditingTools: vi.fn(),
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

import {
  consumerIntegrationService,
  createSkillEditingTools
} from '@metorial/module-consumer-entities';
import {
  ensureMagicMcpSubspaceSession,
  magicMcpTokenService,
  resolveMagicMcpTargetByIdOrAlias,
  resolveMagicMcpTargetByIdOrAliasSafe
} from '@metorial/module-magic';
import { resolveMagicMcpRequestTools, resolveMagicMcpSubspaceSession } from '../src/magic';

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

describe('resolveMagicMcpRequestTools', () => {
  let context = { ip: '127.0.0.1', ua: 'test' };
  let instance = { id: 'ins_1', oid: 22n };
  let consumerProfile = { oid: 55n };
  let skillEditingTools = { tools: [], call: vi.fn(), redactForLog: vi.fn() };

  let endpointSession = (d: {
    enableSkillEditing: boolean;
    consumerTokens?: { consumerProfile: unknown }[];
    tokenSkillPluginOid?: bigint | null;
    endpointSkillPluginOid?: bigint | null;
    withoutToken?: boolean;
  }) =>
    ({
      magicMcpTarget: {
        type: 'endpoint',
        target: {
          id: 'mep_1',
          oid: 11n,
          instance,
          enableSkillEditing: d.enableSkillEditing,
          skillPluginOid:
            d.endpointSkillPluginOid === undefined ? 66n : d.endpointSkillPluginOid
        }
      },
      magicMcpToken: d.withoutToken
        ? null
        : {
            id: 'mmt_1',
            skillPluginOid: d.tokenSkillPluginOid ?? null,
            consumerTokens: d.consumerTokens ?? []
          },
      consumerToken: d.consumerTokens?.[0] ?? null
    }) as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSkillEditingTools).mockResolvedValue(skillEditingTools as any);
  });

  it('lazily builds skill editing tools for a consumer token on an enabled endpoint', async () => {
    let resolveTools = resolveMagicMcpRequestTools({
      sessionInfo: endpointSession({
        enableSkillEditing: true,
        consumerTokens: [{ consumerProfile }]
      }),
      context
    });

    expect(resolveTools).toBeTypeOf('function');
    expect(createSkillEditingTools).not.toHaveBeenCalled();

    expect(await resolveTools!()).toBe(skillEditingTools);
    expect(createSkillEditingTools).toHaveBeenCalledWith({
      instance,
      consumerProfile,
      skillPluginOid: 66n,
      context
    });
  });

  it.each([
    ['only the token', 77n, null, 77n],
    ['the token and the endpoint with the same plugin', 66n, 66n, 66n]
  ])(
    'scopes the tools to the skill plugin set on %s',
    async (_name, tokenSkillPluginOid, endpointSkillPluginOid, expected) => {
      let resolveTools = resolveMagicMcpRequestTools({
        sessionInfo: endpointSession({
          enableSkillEditing: true,
          consumerTokens: [{ consumerProfile }],
          tokenSkillPluginOid,
          endpointSkillPluginOid
        }),
        context
      });

      await resolveTools!();

      expect(createSkillEditingTools).toHaveBeenCalledWith(
        expect.objectContaining({ skillPluginOid: expected })
      );
    }
  );

  it('skips the tools when the token and the endpoint are scoped to different plugins', () => {
    let resolveTools = resolveMagicMcpRequestTools({
      sessionInfo: endpointSession({
        enableSkillEditing: true,
        consumerTokens: [{ consumerProfile }],
        tokenSkillPluginOid: 77n,
        endpointSkillPluginOid: 66n
      }),
      context
    });

    expect(resolveTools).toBeUndefined();
    expect(createSkillEditingTools).not.toHaveBeenCalled();
  });

  it('skips the tools without any lookups when the endpoint flag is off', () => {
    let resolveTools = resolveMagicMcpRequestTools({
      sessionInfo: endpointSession({
        enableSkillEditing: false,
        consumerTokens: [{ consumerProfile }]
      }),
      context
    });

    expect(resolveTools).toBeUndefined();
    expect(createSkillEditingTools).not.toHaveBeenCalled();
  });

  it.each([
    ['no consumer token', { consumerTokens: [] }],
    [
      'more than one consumer token',
      { consumerTokens: [{ consumerProfile }, { consumerProfile: { oid: 56n } }] }
    ],
    ['a publishable key instead of a magic MCP token', { withoutToken: true }]
  ])('skips the tools for callers with %s', (_name, session) => {
    let resolveTools = resolveMagicMcpRequestTools({
      sessionInfo: endpointSession({ enableSkillEditing: true, ...session }),
      context
    });

    expect(resolveTools).toBeUndefined();
    expect(createSkillEditingTools).not.toHaveBeenCalled();
  });

  it('skips the tools for server targets', () => {
    let resolveTools = resolveMagicMcpRequestTools({
      sessionInfo: {
        magicMcpTarget: { type: 'server', target: { id: 'mms_1', instance } },
        magicMcpToken: { skillPluginOid: null, consumerTokens: [{ consumerProfile }] },
        consumerToken: { consumerProfile }
      } as any,
      context
    });

    expect(resolveTools).toBeUndefined();
    expect(createSkillEditingTools).not.toHaveBeenCalled();
  });

  it('resolves to no tools when skills are unavailable for the consumer', async () => {
    vi.mocked(createSkillEditingTools).mockResolvedValue(null);

    let resolveTools = resolveMagicMcpRequestTools({
      sessionInfo: endpointSession({
        enableSkillEditing: true,
        consumerTokens: [{ consumerProfile }]
      }),
      context
    });

    expect(await resolveTools!()).toBeNull();
  });
});
