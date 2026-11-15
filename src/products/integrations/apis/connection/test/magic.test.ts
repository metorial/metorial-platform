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
  createConsumerSkillSource: vi.fn(),
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
  createSkillEditingTools,
  createConsumerSkillSource
} from '@metorial/module-consumer-entities';
import {
  ensureMagicMcpSubspaceSession,
  magicMcpTokenService,
  resolveMagicMcpTargetByIdOrAlias,
  resolveMagicMcpTargetByIdOrAliasSafe
} from '@metorial/module-magic';
import {
  resolveMagicMcpRequestExtensions,
  resolveMagicMcpSubspaceSession
} from '../src/magic';

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

describe('resolveMagicMcpRequestExtensions', () => {
  let context = { ip: '127.0.0.1', ua: 'test' };
  let instance = { id: 'ins_1', oid: 22n };
  let consumerProfile = { oid: 55n };
  let skillEditingTools = { tools: [], call: vi.fn(), redactForLog: vi.fn() };
  let skillCatalog = {
    listSkills: vi.fn(),
    getSkill: vi.fn(),
    readResource: vi.fn(),
    readDirectory: vi.fn()
  };

  let endpointSession = (d: {
    enableSkillEditing?: boolean;
    enableSkillResources?: boolean;
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
          enableSkillEditing: d.enableSkillEditing ?? false,
          enableSkillResources: d.enableSkillResources ?? false,
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
    vi.mocked(createConsumerSkillSource).mockResolvedValue(skillCatalog as any);
  });

  it('lazily builds skill editing tools for a consumer token on an enabled endpoint', async () => {
    let { requestTools, requestSkills } = resolveMagicMcpRequestExtensions({
      sessionInfo: endpointSession({
        enableSkillEditing: true,
        consumerTokens: [{ consumerProfile }]
      }),
      context
    });

    expect(requestTools).toBeTypeOf('function');
    expect(requestSkills).toBeUndefined();
    expect(createSkillEditingTools).not.toHaveBeenCalled();

    expect(await requestTools!()).toBe(skillEditingTools);
    expect(createSkillEditingTools).toHaveBeenCalledWith({
      instance,
      consumerProfile,
      skillPluginOid: 66n,
      magicMcpEndpoint: expect.objectContaining({ oid: 11n }),
      context
    });
  });

  it('lazily builds the skill catalog when only skill resources are enabled', async () => {
    let { requestTools, requestSkills } = resolveMagicMcpRequestExtensions({
      sessionInfo: endpointSession({
        enableSkillResources: true,
        consumerTokens: [{ consumerProfile }]
      }),
      context
    });

    expect(requestTools).toBeUndefined();
    expect(requestSkills).toBeTypeOf('function');
    expect(createConsumerSkillSource).not.toHaveBeenCalled();

    expect(await requestSkills!()).toBe(skillCatalog);
    expect(createConsumerSkillSource).toHaveBeenCalledWith({
      instance,
      consumerProfile,
      skillPluginOid: 66n,
      magicMcpEndpoint: expect.objectContaining({ oid: 11n }),
      context
    });
  });

  it('builds both when skill resources and skill editing are enabled', () => {
    let { requestTools, requestSkills } = resolveMagicMcpRequestExtensions({
      sessionInfo: endpointSession({
        enableSkillEditing: true,
        enableSkillResources: true,
        consumerTokens: [{ consumerProfile }]
      }),
      context
    });

    expect(requestTools).toBeTypeOf('function');
    expect(requestSkills).toBeTypeOf('function');
  });

  it.each([
    ['only the token', 77n, null, 77n],
    ['the token and the endpoint with the same plugin', 66n, 66n, 66n]
  ])(
    'scopes the tools to the skill plugin set on %s',
    async (_name, tokenSkillPluginOid, endpointSkillPluginOid, expected) => {
      let { requestTools } = resolveMagicMcpRequestExtensions({
        sessionInfo: endpointSession({
          enableSkillEditing: true,
          consumerTokens: [{ consumerProfile }],
          tokenSkillPluginOid,
          endpointSkillPluginOid
        }),
        context
      });

      await requestTools!();

      expect(createSkillEditingTools).toHaveBeenCalledWith(
        expect.objectContaining({ skillPluginOid: expected })
      );
    }
  );

  it('skips everything when the token and the endpoint are scoped to different plugins', () => {
    let extensions = resolveMagicMcpRequestExtensions({
      sessionInfo: endpointSession({
        enableSkillEditing: true,
        enableSkillResources: true,
        consumerTokens: [{ consumerProfile }],
        tokenSkillPluginOid: 77n,
        endpointSkillPluginOid: 66n
      }),
      context
    });

    expect(extensions).toEqual({});
    expect(createSkillEditingTools).not.toHaveBeenCalled();
    expect(createConsumerSkillSource).not.toHaveBeenCalled();
  });

  it('skips everything without any lookups when both endpoint flags are off', () => {
    let extensions = resolveMagicMcpRequestExtensions({
      sessionInfo: endpointSession({ consumerTokens: [{ consumerProfile }] }),
      context
    });

    expect(extensions).toEqual({});
    expect(createSkillEditingTools).not.toHaveBeenCalled();
    expect(createConsumerSkillSource).not.toHaveBeenCalled();
  });

  it.each([
    ['no consumer token', { consumerTokens: [] }],
    [
      'more than one consumer token',
      { consumerTokens: [{ consumerProfile }, { consumerProfile: { oid: 56n } }] }
    ],
    ['a publishable key instead of a magic MCP token', { withoutToken: true }]
  ])('skips everything for callers with %s', (_name, session) => {
    let extensions = resolveMagicMcpRequestExtensions({
      sessionInfo: endpointSession({
        enableSkillEditing: true,
        enableSkillResources: true,
        ...session
      }),
      context
    });

    expect(extensions).toEqual({});
    expect(createSkillEditingTools).not.toHaveBeenCalled();
    expect(createConsumerSkillSource).not.toHaveBeenCalled();
  });

  it('skips everything for server targets', () => {
    let extensions = resolveMagicMcpRequestExtensions({
      sessionInfo: {
        magicMcpTarget: { type: 'server', target: { id: 'mms_1', instance } },
        magicMcpToken: { skillPluginOid: null, consumerTokens: [{ consumerProfile }] },
        consumerToken: { consumerProfile }
      } as any,
      context
    });

    expect(extensions).toEqual({});
  });

  it('resolves to nothing when skills are unavailable for the consumer', async () => {
    vi.mocked(createSkillEditingTools).mockResolvedValue(null);
    vi.mocked(createConsumerSkillSource).mockResolvedValue(null);

    let { requestTools, requestSkills } = resolveMagicMcpRequestExtensions({
      sessionInfo: endpointSession({
        enableSkillEditing: true,
        enableSkillResources: true,
        consumerTokens: [{ consumerProfile }]
      }),
      context
    });

    expect(await requestTools!()).toBeNull();
    expect(await requestSkills!()).toBeNull();
  });
});
