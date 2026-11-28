import { notFoundError, ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  agentTrackingSessionService,
  maxToolCallSessionLookups
} from '../src/services/agentTrackingSession';
import {
  agentTrackingEnabled,
  callsTo,
  desktop,
  privacy,
  rejection,
  remoteMember,
  remoteRepository,
  resetMocks,
  rpc,
  scope,
  toolCalls
} from './_mocks';

let actor = { id: 'oac_ada' };

let toolCallScope = (overrides: Record<string, unknown> = {}) =>
  ({
    ...scope,
    organizationActor: actor,
    canReadToolCalls: true,
    ...overrides
  }) as any;

let agentCall = (toolCallId: string, overrides: Record<string, unknown> = {}) => ({
  object: 'agent_tracking#session_tool_call',
  clientFamily: 'claude-code',
  toolCallId,
  occurredAt: new Date('2026-11-17T09:00:00Z'),
  durationMs: 120,
  outcome: 'success',
  mcpServer: null,
  mcpTool: null,
  ...overrides
});

let metorialRow = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  instanceId: 'inst_1',
  clientCallId: null as string | null,
  clientCallSource: 'claude-code' as string | null,
  createdAt: new Date('2026-11-17T09:00:01Z'),
  tool: {
    id: 'pto_issue',
    key: 'create_issue',
    name: 'Create Issue',
    provider: { id: 'pro_linear', name: 'Linear' }
  },
  message: {
    id: `smg_${id}`,
    status: 'succeeded',
    session: { id: 'ses_1' },
    connection: { id: 'scn_1' }
  },
  ...overrides
});

let remoteSession = (overrides: Record<string, unknown> = {}) => ({
  object: 'agent_tracking#session',
  sessionKey: 'c0ffee',
  projectId: 'proj_1',
  instanceId: 'inst_1',
  state: 'ended',
  client: { family: 'claude-code', surface: 'cli', version: '2.1.317' },
  observed: { userId: 'aten_ada', deviceId: 'aten_device', agentId: null },
  context: {
    workspaceIds: [],
    repoIds: ['aten_repo'],
    branch: 'ada/eng-12-login',
    title: 'Fix the login page',
    ticketRefs: ['ENG-12'],
    tags: [],
    pathStored: false
  },
  summary: null,
  summaryStale: false,
  startedAt: new Date('2026-11-17T09:00:00Z'),
  lastActivityAt: new Date('2026-11-17T10:00:00Z'),
  endedAt: null,
  ...overrides
});

let mcpToolCalls =
  (items: unknown[], overrides: Record<string, unknown> = {}) =>
  () => ({
    object: 'list',
    sessionKey: 'c0ffee',
    instanceId: 'inst_1',
    hasMore: false,
    items,
    ...overrides
  });

describe('agentTrackingSessionService.listSessionToolCalls', () => {
  let list = (overrides: Record<string, unknown> = {}) =>
    agentTrackingSessionService.listSessionToolCalls({
      ...toolCallScope(overrides),
      sessionId: 'atse_c0ffee'
    });

  beforeEach(() => {
    resetMocks();
    rpc.handlers['session:findByToolCalls'] = () => ({
      object: 'list',
      items: [],
      ambiguous: [],
      sessions: []
    });
  });

  it('answers not found without asking agent tracking while it is off', async () => {
    agentTrackingEnabled.mockImplementation(async () => false);

    expect(await rejection(list())).toMatchObject({ status: 404, entity: 'agent_tracking' });
    expect(rpc.calls).toEqual([]);
    expect(toolCalls.listToolCalls).not.toHaveBeenCalled();
  });

  it('refuses an organization that hides individuals before reading anything', async () => {
    privacy.hideIndividuals = true;

    expect(await rejection(list())).toMatchObject({
      status: 403,
      code: 'agent_tracking_individuals_hidden'
    });
    expect(rpc.calls).toEqual([]);
    expect(toolCalls.listToolCalls).not.toHaveBeenCalled();
  });

  it('answers not found for a session of another instance or an unknown session', async () => {
    rpc.handlers['session:listMcpToolCalls'] = mcpToolCalls([agentCall('toolu_1')], {
      instanceId: 'inst_2'
    });
    expect(await rejection(list())).toMatchObject({
      status: 404,
      entity: 'agent_tracking.session'
    });

    rpc.handlers['session:listMcpToolCalls'] = () => {
      throw new ServiceError(notFoundError('session', 'beef'));
    };
    expect(
      await rejection(
        agentTrackingSessionService.listSessionToolCalls({
          ...toolCallScope(),
          sessionId: 'atse_beef'
        })
      )
    ).toMatchObject({ status: 404, entity: 'agent_tracking.session' });

    expect(
      await rejection(
        agentTrackingSessionService.listSessionToolCalls({
          ...toolCallScope(),
          sessionId: 'ses_c0ffee'
        })
      )
    ).toMatchObject({ status: 404 });
    expect(toolCalls.listToolCalls).not.toHaveBeenCalled();
  });

  it('lists the matched calls oldest first with the agent time, duration and outcome', async () => {
    rpc.handlers['session:listMcpToolCalls'] = mcpToolCalls([
      agentCall('toolu_1', { occurredAt: new Date('2026-11-17T09:00:00Z') }),
      agentCall('exec-2', {
        clientFamily: 'codex',
        occurredAt: new Date('2026-11-17T09:05:00Z'),
        durationMs: null,
        outcome: null
      })
    ]);
    toolCalls.rows = [
      metorialRow('tcl_b', { clientCallId: 'toolu_1' }),
      metorialRow('tcl_a', {
        clientCallId: 'exec-2',
        clientCallSource: 'codex',
        message: {
          id: 'smg_a',
          status: 'failed',
          session: { id: 'ses_2' },
          connection: null
        }
      })
    ];

    let result = await list();

    expect(result).toEqual({
      sessionId: 'atse_c0ffee',
      items: [
        {
          occurredAt: new Date('2026-11-17T09:00:00Z'),
          durationMs: 120,
          outcome: 'success',
          toolCall: {
            id: 'tcl_b',
            status: 'succeeded',
            tool: { id: 'pto_issue', key: 'create_issue', name: 'Create Issue' },
            provider: { id: 'pro_linear', name: 'Linear' },
            sessionId: 'ses_1',
            connectionId: 'scn_1',
            messageId: 'smg_tcl_b',
            createdAt: new Date('2026-11-17T09:00:01Z')
          }
        },
        {
          occurredAt: new Date('2026-11-17T09:05:00Z'),
          durationMs: null,
          outcome: null,
          toolCall: expect.objectContaining({
            id: 'tcl_a',
            status: 'failed',
            sessionId: 'ses_2',
            connectionId: null,
            messageId: 'smg_a'
          })
        }
      ],
      unmatchedCount: 0,
      hasMore: false
    });
    expect(toolCalls.listToolCalls.mock.calls.map(([input]) => input)).toEqual([
      expect.objectContaining({
        instance: scope.instance,
        organizationActor: actor,
        clientCallIds: ['toolu_1'],
        clientCallSource: 'claude-code'
      }),
      expect.objectContaining({ clientCallIds: ['exec-2'], clientCallSource: 'codex' })
    ]);
  });

  it('matches on the client family as well as the id', async () => {
    rpc.handlers['session:listMcpToolCalls'] = mcpToolCalls([agentCall('call_1')]);
    toolCalls.rows = [
      metorialRow('tcl_a', { clientCallId: 'call_1', clientCallSource: 'codex' })
    ];

    let result = await list();

    expect(result.items).toEqual([]);
    expect(result.unmatchedCount).toBe(1);
  });

  it('lists every Metorial call that carries the same client call id', async () => {
    rpc.handlers['session:listMcpToolCalls'] = mcpToolCalls([agentCall('toolu_1')]);
    toolCalls.rows = [
      metorialRow('tcl_b', { clientCallId: 'toolu_1' }),
      metorialRow('tcl_a', { clientCallId: 'toolu_1' })
    ];

    let result = await list();

    expect(result.items.map(item => item.toolCall.id)).toEqual(['tcl_a', 'tcl_b']);
    expect(result.unmatchedCount).toBe(0);
  });

  it('links no Metorial call to an agent call id that is ambiguous across sessions', async () => {
    rpc.handlers['session:listMcpToolCalls'] = mcpToolCalls([
      agentCall('toolu_1'),
      agentCall('toolu_2'),
      agentCall('toolu_3')
    ]);
    rpc.handlers['session:findByToolCalls'] = () => ({
      object: 'list',
      items: [],
      ambiguous: [{ clientFamily: 'claude-code', toolCallId: 'toolu_2' }],
      sessions: []
    });
    toolCalls.rows = [
      metorialRow('tcl_a', { clientCallId: 'toolu_1' }),
      metorialRow('tcl_b', { clientCallId: 'toolu_2' })
    ];

    let result = await list();

    expect(result.items.map(item => item.toolCall.id)).toEqual(['tcl_a']);
    expect(result.unmatchedCount).toBe(2);
    expect(callsTo('session:findByToolCalls').map(call => call.input)).toEqual([
      {
        organizationId: 'org_1',
        instanceId: 'inst_1',
        toolCalls: [
          { clientFamily: 'claude-code', toolCallId: 'toolu_1' },
          { clientFamily: 'claude-code', toolCallId: 'toolu_2' }
        ]
      }
    ]);
  });

  it('links nothing for the ids it could not check and keeps the other batches', async () => {
    let ids = Array.from({ length: 250 }, (_, i) => `toolu_${String(i).padStart(3, '0')}`);
    rpc.handlers['session:listMcpToolCalls'] = mcpToolCalls(ids.map(id => agentCall(id)));
    toolCalls.rows = ids.map(id => metorialRow(`tcl_${id.slice(6)}`, { clientCallId: id }));
    rpc.handlers['session:findByToolCalls'] = ({ toolCalls: asked }) => {
      if (asked.length == 200) throw new ServiceError(notFoundError('instance', 'inst_1'));
      return { object: 'list', items: [], ambiguous: [], sessions: [] };
    };

    let result = await list();

    expect(result.items.map(item => item.toolCall.id)).toEqual(
      ids.slice(200).map(id => `tcl_${id.slice(6)}`)
    );
    expect(result.unmatchedCount).toBe(200);
  });

  it('checks the ambiguity of at most 200 matched calls at once', async () => {
    let ids = Array.from({ length: 450 }, (_, i) => `toolu_${String(i).padStart(3, '0')}`);
    rpc.handlers['session:listMcpToolCalls'] = mcpToolCalls(ids.map(id => agentCall(id)));
    toolCalls.rows = ids.map(id => metorialRow(`tcl_${id.slice(6)}`, { clientCallId: id }));

    await list();

    expect(
      callsTo('session:findByToolCalls').map(call => call.input.toolCalls.length)
    ).toEqual([200, 200, 50]);
  });

  it('counts the calls that did not go through Metorial and passes the cut-off on', async () => {
    rpc.handlers['session:listMcpToolCalls'] = mcpToolCalls(
      [
        agentCall('toolu_1'),
        agentCall('toolu_2'),
        agentCall('call_3', { clientFamily: 'cursor' })
      ],
      { hasMore: true }
    );
    toolCalls.rows = [metorialRow('tcl_a', { clientCallId: 'toolu_1' })];

    let result = await list();

    expect(result.items.map(item => item.toolCall.id)).toEqual(['tcl_a']);
    expect(result.unmatchedCount).toBe(2);
    expect(result.hasMore).toBe(true);
    expect(toolCalls.listToolCalls).toHaveBeenCalledTimes(1);
  });

  it('looks client call ids up in chunks of at most 200 and pages through each chunk', async () => {
    let ids = Array.from({ length: 450 }, (_, i) => `toolu_${String(i).padStart(3, '0')}`);
    rpc.handlers['session:listMcpToolCalls'] = mcpToolCalls(ids.map(id => agentCall(id)));
    toolCalls.rows = ids.map(id => metorialRow(`tcl_${id.slice(6)}`, { clientCallId: id }));

    let result = await list();

    let lookups = toolCalls.listToolCalls.mock.calls.map(([input]) => input.clientCallIds);
    expect(lookups.map(chunk => chunk.length)).toEqual([200, 200, 50]);
    expect(lookups.flat()).toEqual(ids);
    expect(result.items).toHaveLength(450);
    expect(result.unmatchedCount).toBe(0);
  });

  it('reports a lookup cut short by the paging cap as more', async () => {
    rpc.handlers['session:listMcpToolCalls'] = mcpToolCalls([agentCall('toolu_1')]);
    toolCalls.rows = Array.from({ length: 1001 }, (_, i) =>
      metorialRow(`tcl_${String(i).padStart(4, '0')}`, { clientCallId: 'toolu_1' })
    );

    let result = await list();

    expect(result.items).toHaveLength(1000);
    expect(result.hasMore).toBe(true);
  });

  it('asks for tool calls without their message bodies', async () => {
    rpc.handlers['session:listMcpToolCalls'] = mcpToolCalls([agentCall('toolu_1')]);

    await list();

    expect(toolCalls.listToolCalls.mock.calls[0]![0]).toMatchObject({
      omitBodies: true,
      allowDeleted: false
    });
  });

  it('passes the organization actor through to the Metorial tool call lookup', async () => {
    rpc.handlers['session:listMcpToolCalls'] = mcpToolCalls([
      agentCall('toolu_1'),
      agentCall('toolu_2')
    ]);
    toolCalls.rows = [metorialRow('tcl_a', { clientCallId: 'toolu_1' })];

    let result = await list();

    expect(result.items.map(item => item.toolCall.id)).toEqual(['tcl_a']);
    expect(toolCalls.listToolCalls).toHaveBeenCalledWith(
      expect.objectContaining({ instance: scope.instance, organizationActor: actor })
    );
  });

  it('lists nothing and reveals no count to an actor who cannot read tool calls', async () => {
    rpc.handlers['session:listMcpToolCalls'] = mcpToolCalls([agentCall('toolu_1')], {
      hasMore: true
    });
    toolCalls.rows = [metorialRow('tcl_a', { clientCallId: 'toolu_1' })];

    expect(await list({ canReadToolCalls: false })).toEqual({
      sessionId: 'atse_c0ffee',
      items: [],
      unmatchedCount: null,
      hasMore: false
    });
    expect(toolCalls.listToolCalls).not.toHaveBeenCalled();
    expect(callsTo('session:findByToolCalls')).toEqual([]);
  });
});

describe('agentTrackingSessionService.listToolCallSessions', () => {
  let lookup = (toolCallIds: string[], overrides: Record<string, unknown> = {}) =>
    agentTrackingSessionService.listToolCallSessions({
      ...toolCallScope(overrides),
      toolCallIds
    });

  let found = (overrides: Record<string, unknown> = {}) => ({
    object: 'list',
    items: [
      {
        object: 'agent_tracking#tool_call_session',
        sessionKey: 'c0ffee',
        clientFamily: 'claude-code',
        toolCallId: 'toolu_1',
        occurredAt: new Date('2026-11-17T09:00:00Z')
      }
    ],
    ambiguous: [],
    sessions: [remoteSession()],
    ...overrides
  });

  beforeEach(() => {
    resetMocks();
    rpc.handlers['entity:list'] = ({ kinds }) => ({
      items: kinds.includes('repo') ? [remoteRepository()] : [remoteMember()],
      pagination: {}
    });
    rpc.handlers['knowledge:models:get'] = ({ modelId }) => ({ id: modelId, name: null });
    toolCalls.rows = [
      metorialRow('tcl_a', { clientCallId: 'toolu_1' }),
      metorialRow('tcl_b', { clientCallId: 'toolu_1' }),
      metorialRow('tcl_c', { clientCallId: 'toolu_9' }),
      metorialRow('tcl_d', { clientCallSource: null })
    ];
  });

  it('answers not found without reading anything while agent tracking is off', async () => {
    agentTrackingEnabled.mockImplementation(async () => false);

    expect(await rejection(lookup(['tcl_a']))).toMatchObject({ status: 404 });
    expect(rpc.calls).toEqual([]);
    expect(toolCalls.listToolCalls).not.toHaveBeenCalled();
  });

  it('refuses an organization that hides individuals', async () => {
    privacy.hideIndividuals = true;

    expect(await rejection(lookup(['tcl_a']))).toMatchObject({
      status: 403,
      code: 'agent_tracking_individuals_hidden'
    });
    expect(rpc.calls).toEqual([]);
    expect(toolCalls.listToolCalls).not.toHaveBeenCalled();
  });

  it('returns the agent session of each matched tool call, in the order asked', async () => {
    rpc.handlers['session:findByToolCalls'] = () => found();

    let result = await lookup(['tcl_b', 'tcl_c', 'tcl_d', 'tcl_a', 'tcl_unknown']);

    expect(result.map(item => [item.toolCallId, item.session.id])).toEqual([
      ['tcl_b', 'atse_c0ffee'],
      ['tcl_a', 'atse_c0ffee']
    ]);
    expect(result[0]!.session).toMatchObject({
      client: { family: 'claude_code' },
      member: { id: 'aten_ada', name: 'Ada' },
      context: {
        branch: 'ada/eng-12-login',
        title: null,
        tickets: [{ key: 'ENG-12' }],
        repositories: [{ id: 'aten_repo', owner: 'acme', name: 'api' }]
      }
    });
    expect(callsTo('session:findByToolCalls')).toHaveLength(1);
    expect(callsTo('session:findByToolCalls')[0]!.input).toEqual({
      organizationId: 'org_1',
      instanceId: 'inst_1',
      toolCalls: [
        { clientFamily: 'claude-code', toolCallId: 'toolu_1' },
        { clientFamily: 'claude-code', toolCallId: 'toolu_9' }
      ]
    });
    expect(toolCalls.listToolCalls.mock.calls[0]![0]).toMatchObject({
      instance: scope.instance,
      organizationActor: actor,
      ids: ['tcl_b', 'tcl_c', 'tcl_d', 'tcl_a', 'tcl_unknown']
    });
  });

  it('shows the session title only while the organization allows titles', async () => {
    rpc.handlers['session:findByToolCalls'] = () => found();

    expect((await lookup(['tcl_a']))[0]!.session.context.title).toBeNull();

    desktop.sessionTitles = true;
    expect((await lookup(['tcl_a']))[0]!.session.context.title).toBe('Fix the login page');
  });

  it('links nothing for an ambiguous call or a session of another instance', async () => {
    rpc.handlers['session:findByToolCalls'] = () =>
      found({
        items: [
          ...found().items,
          {
            object: 'agent_tracking#tool_call_session',
            sessionKey: 'beef',
            clientFamily: 'claude-code',
            toolCallId: 'toolu_9',
            occurredAt: new Date('2026-11-17T09:00:00Z')
          }
        ],
        ambiguous: [{ clientFamily: 'claude-code', toolCallId: 'toolu_1' }],
        sessions: [
          remoteSession(),
          remoteSession({ sessionKey: 'beef', instanceId: 'inst_2' })
        ]
      });

    expect(await lookup(['tcl_a', 'tcl_c'])).toEqual([]);
  });

  it('asks agent tracking nothing when the actor can see none of the tool calls', async () => {
    toolCalls.rows = [];
    rpc.handlers['session:findByToolCalls'] = () => found();

    expect(await lookup(['tcl_a'])).toEqual([]);
    expect(callsTo('session:findByToolCalls')).toEqual([]);
    expect(toolCalls.listToolCalls).toHaveBeenCalledWith(
      expect.objectContaining({ instance: scope.instance, organizationActor: actor })
    );
  });

  it('returns nothing to an actor who cannot read tool calls', async () => {
    rpc.handlers['session:findByToolCalls'] = () => found();

    expect(await lookup(['tcl_a'], { canReadToolCalls: false })).toEqual([]);
    expect(rpc.calls).toEqual([]);
    expect(toolCalls.listToolCalls).not.toHaveBeenCalled();
  });

  it(`refuses more than ${maxToolCallSessionLookups} tool calls at once`, async () => {
    let ids = Array.from({ length: maxToolCallSessionLookups + 1 }, (_, i) => `tcl_${i}`);

    expect(await rejection(lookup(ids))).toMatchObject({ status: 400 });
    expect(await lookup([...ids.slice(0, maxToolCallSessionLookups), 'tcl_0'])).toEqual([]);
    expect(toolCalls.listToolCalls).toHaveBeenCalledTimes(1);
  });
});
