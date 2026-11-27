import type { Instance, Organization } from '@mtsrc/agent-tracking-db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { matchesFilter } from '../src/lib/filter';
import { sessionToolCallService } from '../src/services/sessionToolCall';

let state = vi.hoisted(() => ({
  memory: false,
  storedSessions: [] as Record<string, unknown>[],
  storedEvents: [] as Record<string, any>[],
  eventsRead: 0
}));

let cursorOver = (documents: Record<string, any>[], limit?: number) => {
  let selected = limit === undefined ? documents : documents.slice(0, limit);
  let iterate = async function* () {
    for (let document of selected) {
      state.eventsRead++;
      yield document;
    }
  };

  return {
    sort: () => iterate(),
    toArray: async () => {
      state.eventsRead += selected.length;
      return selected;
    }
  };
};

vi.mock('@mtsrc/agent-tracking-store', () => ({
  defaultStoragePolicy: {},
  isStoreConfigured: () => true,
  getStore: () => ({
    ready: async () => {},
    collections: () => ({
      sessions: {
        findOne: async (filter: Record<string, unknown>) =>
          state.storedSessions.find(session => matchesFilter(session, filter)) ?? null,
        find: (filter: Record<string, unknown>) => ({
          toArray: async () =>
            state.storedSessions.filter(session => matchesFilter(session, filter))
        })
      },
      events: {
        find: (filter: Record<string, unknown>, options: { limit?: number }) => {
          let found = state.storedEvents
            .filter(event => matchesFilter(event, filter))
            .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

          return cursorOver(found, options.limit);
        }
      }
    })
  })
}));

vi.mock('@mtsrc/agent-tracking-module-records', () => ({
  recordReadbackService: {
    isAvailable: () => state.memory,
    list: async (filter: { organizationId: string; instanceId?: string }) =>
      [...state.storedEvents]
        .reverse()
        .filter(
          event =>
            event.organizationId == filter.organizationId &&
            (!filter.instanceId || event.instanceId == filter.instanceId)
        )
        .map(event => ({ record: { kind: 'event', type: event.type, event } }))
  },
  toRecordDocument: (record: { event: Record<string, unknown> }) => ({
    document: record.event
  })
}));

let organization = { id: 'ator_1' } as Organization;

let instance = { id: 'atin_1' } as Instance;

let base = Date.parse('2026-11-27T10:00:00Z');

let event = (d: {
  toolCallId: string;
  sessionKey: string;
  organizationId?: string;
  instanceId?: string;
  family?: string;
  at?: number;
}) => ({
  _id: `rec_${d.toolCallId}_${d.sessionKey}`,
  organizationId: d.organizationId ?? 'ator_1',
  instanceId: d.instanceId ?? 'atin_1',
  type: 'tool.call',
  occurredAt: new Date(base + (d.at ?? 0)),
  source: { adapter: 'test', dialect: 'test.v1', channel: 'hook', role: 'primary' },
  client: { family: d.family ?? 'claude-code' },
  ctx: { sessionKey: d.sessionKey, toolCallId: d.toolCallId },
  data: { tool: { name: 'mcp__linear__create_issue', kind: 'mcp', class: 'mcp' } }
});

let manyCalls = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    event({
      toolCallId: `toolu_${String(index).padStart(4, '0')}`,
      sessionKey: 'session-1',
      at: index * 60_000
    })
  );

let storePaths = [
  { name: 'record store', memory: false },
  { name: 'in-memory store', memory: true }
];

describe('sessionToolCallService', () => {
  beforeEach(() => {
    state.memory = false;
    state.storedSessions = [
      { _id: 'session-1', organizationId: 'ator_1', instanceId: 'atin_1' },
      { _id: 'session-2', organizationId: 'ator_1', instanceId: 'atin_1' }
    ];
    state.storedEvents = [];
    state.eventsRead = 0;
  });

  describe('listSessionMcpToolCalls', () => {
    it("reads the session's MCP tool calls through the session index", async () => {
      state.storedEvents = [event({ toolCallId: 'toolu_1', sessionKey: 'session-1' })];

      let result = await sessionToolCallService.listSessionMcpToolCalls({
        organization,
        sessionKey: 'session-1'
      });

      expect(result.session).toMatchObject({ _id: 'session-1', instanceId: 'atin_1' });
      expect(result.items.map(item => item.toolCallId)).toEqual(['toolu_1']);
      expect(result.hasMore).toBe(false);
    });

    it("answers not found for another organization's session, like the session read", async () => {
      state.storedSessions = [{ _id: 'session-1', organizationId: 'ator_2' }];

      await expect(
        sessionToolCallService.listSessionMcpToolCalls({
          organization,
          sessionKey: 'session-1'
        })
      ).rejects.toMatchObject({ data: { status: 404, code: 'not_found', entity: 'session' } });
      expect(state.eventsRead).toBe(0);
    });

    for (let path of storePaths) {
      it(`bounds more than 500 calls and stops early (${path.name})`, async () => {
        state.memory = path.memory;
        state.storedEvents = manyCalls(1200);

        let result = await sessionToolCallService.listSessionMcpToolCalls({
          organization,
          sessionKey: 'session-1'
        });

        expect(result.hasMore).toBe(true);
        expect(result.items).toHaveLength(500);
        expect(result.items[0]!.toolCallId).toBe('toolu_0000');
        expect(result.items[499]!.toolCallId).toBe('toolu_0499');
        if (!path.memory) expect(state.eventsRead).toBeLessThan(520);
      });

      it(`says there are no more at exactly 500 calls (${path.name})`, async () => {
        state.memory = path.memory;
        state.storedEvents = manyCalls(500);

        let result = await sessionToolCallService.listSessionMcpToolCalls({
          organization,
          sessionKey: 'session-1'
        });

        expect(result.hasMore).toBe(false);
        expect(result.items).toHaveLength(500);
      });
    }
  });

  describe('findSessionsForToolCalls', () => {
    it('looks each id up within the organization and instance, bounded', async () => {
      state.storedSessions.push({
        _id: 'session-3',
        organizationId: 'ator_1',
        instanceId: 'atin_2'
      });
      state.storedEvents = [
        event({ toolCallId: 'toolu_1', sessionKey: 'session-1' }),
        event({ toolCallId: 'toolu_2', sessionKey: 'session-3', instanceId: 'atin_2' }),
        event({ toolCallId: 'toolu_3', sessionKey: 'session-4', organizationId: 'ator_2' })
      ];

      let result = await sessionToolCallService.findSessionsForToolCalls({
        organization,
        instance,
        calls: [
          { clientFamily: 'claude-code', toolCallId: 'toolu_1' },
          { clientFamily: 'claude-code', toolCallId: 'toolu_1' },
          { clientFamily: 'claude-code', toolCallId: 'toolu_2' },
          { clientFamily: 'claude-code', toolCallId: 'toolu_3' },
          { clientFamily: 'claude-code', toolCallId: 'toolu_unknown' }
        ]
      });

      expect(result.items).toEqual([
        expect.objectContaining({ sessionKey: 'session-1', toolCallId: 'toolu_1' })
      ]);
      expect(result.ambiguous).toEqual([]);
      expect(result.sessions.map(session => session._id)).toEqual(['session-1']);
    });

    for (let path of storePaths) {
      it(`links nothing for an id reused across sessions (${path.name})`, async () => {
        state.memory = path.memory;
        state.storedEvents = [
          event({ toolCallId: '1', sessionKey: 'session-1' }),
          event({ toolCallId: '1', sessionKey: 'session-2', at: 1000 }),
          event({ toolCallId: 'toolu_2', sessionKey: 'session-2' })
        ];

        let result = await sessionToolCallService.findSessionsForToolCalls({
          organization,
          instance,
          calls: [
            { clientFamily: 'claude-code', toolCallId: '1' },
            { clientFamily: 'claude-code', toolCallId: 'toolu_2' }
          ]
        });

        expect(result.items.map(item => item.toolCallId)).toEqual(['toolu_2']);
        expect(result.ambiguous).toEqual([{ clientFamily: 'claude-code', toolCallId: '1' }]);
        expect(result.sessions.map(session => session._id)).toEqual(['session-2']);
      });

      it(`reads a bounded number of records for a reused id (${path.name})`, async () => {
        state.memory = path.memory;
        state.storedEvents = Array.from({ length: 300 }, (_, index) =>
          event({ toolCallId: 'call_0', sessionKey: `session-${index}`, at: index })
        );

        let result = await sessionToolCallService.findSessionsForToolCalls({
          organization,
          instance,
          calls: [{ clientFamily: 'claude-code', toolCallId: 'call_0' }]
        });

        expect(result.items).toEqual([]);
        expect(result.ambiguous).toEqual([
          { clientFamily: 'claude-code', toolCallId: 'call_0' }
        ]);
        if (!path.memory) expect(state.eventsRead).toBe(9);
      });
    }

    it('matches an id longer than ingest keeps and returns it as asked', async () => {
      let long = `toolu_${'y'.repeat(400)}`;
      state.storedEvents = [
        event({ toolCallId: long.slice(0, 256), sessionKey: 'session-1' })
      ];

      let result = await sessionToolCallService.findSessionsForToolCalls({
        organization,
        instance,
        calls: [{ clientFamily: 'claude-code', toolCallId: long }]
      });

      expect(result.items).toEqual([
        expect.objectContaining({ sessionKey: 'session-1', toolCallId: long })
      ]);
    });

    it('leaves out a call whose session is not stored', async () => {
      state.storedEvents = [event({ toolCallId: 'toolu_1', sessionKey: 'session-gone' })];

      let result = await sessionToolCallService.findSessionsForToolCalls({
        organization,
        instance,
        calls: [{ clientFamily: 'claude-code', toolCallId: 'toolu_1' }]
      });

      expect(result).toEqual({ items: [], ambiguous: [], sessions: [] });
    });

    it('reads nothing for an empty list and refuses more than 200 calls', async () => {
      expect(
        await sessionToolCallService.findSessionsForToolCalls({
          organization,
          instance,
          calls: []
        })
      ).toEqual({ items: [], ambiguous: [], sessions: [] });
      expect(state.eventsRead).toBe(0);

      await expect(
        sessionToolCallService.findSessionsForToolCalls({
          organization,
          instance,
          calls: Array.from({ length: 201 }, (_, index) => ({
            clientFamily: 'claude-code',
            toolCallId: `toolu_${index}`
          }))
        })
      ).rejects.toMatchObject({ data: { status: 400 } });
    });
  });
});
