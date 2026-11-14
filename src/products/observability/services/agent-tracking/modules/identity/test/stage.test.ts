import { describe, expect, it } from 'vitest';
import type { NormalizedRecord, SessionContextData } from '@mtsrc/agent-tracking-spec';
import type { IngestPrincipal } from '@mtsrc/agent-tracking-records-model';
import { createOrganizationKeyDeriver } from '@mtsrc/agent-tracking-crypto';
import type { PipelineContext } from '@mtsrc/agent-tracking-module-ingest';
import type { RecordDraft } from '@mtsrc/agent-tracking-records-model';
import {
  buildDraft,
  buildNow,
  unitPrincipal
} from '@mtsrc/agent-tracking-dialects/test/build';
import type { PrincipalOverrides } from '@mtsrc/agent-tracking-records-model/test/principal';
import { emailDomainAllowed, planAttribution } from '../src/lib/plan';
import type { EntityRequest, IdentityResolver, LinkRequest } from '../src/lib/resolver';
import { createAttributionStage, sourceTagsClaimKey } from '../src/lib/stage';
import { clientEmailConflictWarning } from '../src/internal/identityResolution';

let createFakeResolver = (d: { userEmails?: Record<string, string[]> } = {}) => {
  let requests: EntityRequest[][] = [];
  let links: LinkRequest[] = [];
  let claims = new Set<string>();
  let touched: string[][] = [];

  let resolver: IdentityResolver = {
    resolveEntities: async ({ requests: batch }) => {
      requests.push(batch);
      return new Map(batch.map(request => [request.key, `ent(${request.key})`]));
    },
    ensureLinks: async ({ links: batch }) => {
      links.push(...batch);
    },
    userEmails: async ({ userIds }) =>
      new Map(userIds.map(id => [id, d.userEmails?.[id] ?? []])),
    claimOnce: async key => {
      if (claims.has(key)) return false;
      claims.add(key);
      return true;
    },
    touch: async ids => {
      touched.push(ids);
    }
  };

  return { resolver, requests, links, claims, touched };
};

let draft = (overrides: Partial<RecordDraft> = {}): RecordDraft => ({
  kind: 'event',
  type: 'prompt.submitted',
  identity: `id-${Math.random()}`,
  client: { family: 'claude-code' },
  ctx: { sessionId: 's-1' },
  ...overrides
});

let keys = createOrganizationKeyDeriver('unit-test-secret');

let run = async (d: {
  principal?: PrincipalOverrides;
  drafts: Partial<RecordDraft>[];
  clientIp?: string;
  fake?: ReturnType<typeof createFakeResolver>;
}) => {
  let principal: IngestPrincipal = unitPrincipal(d.principal);
  let fake = d.fake ?? createFakeResolver();
  let records = d.drafts.map(overrides => buildDraft(draft(overrides), { principal }));

  let context: PipelineContext = {
    request: {
      requestId: 'req-1',
      principal,
      clientIp: d.clientIp
    },
    lane: 'live',
    observedAt: buildNow
  };

  let stage = createAttributionStage({ resolver: fake.resolver, keys });
  await stage.beforeWrite!(context, records);

  return { records, fake, principal };
};

let contextRecord = (data: Partial<SessionContextData>): Partial<RecordDraft> => ({
  type: 'session.context',
  data: { source: 'hook', ...data }
});

describe('attribution stage', () => {
  it('stamps the token user, device and agent', async () => {
    let { records, fake } = await run({
      principal: { binding: { agentId: 'aten_agent_unit' } },
      drafts: [{}]
    });

    expect(records[0]?.attribution).toEqual({
      user_id: 'aten_user_unit',
      device_id: 'aten_device_unit',
      agent_id: 'aten_agent_unit'
    });
    expect(fake.requests.flat()).toEqual([]);
    expect(fake.touched.flat().sort()).toEqual(
      ['aten_agent_unit', 'aten_device_unit', 'aten_user_unit'].sort()
    );
  });

  it('discovers one agent per client family', async () => {
    let { records, fake } = await run({
      drafts: [{}, {}, { client: { family: 'codex' } }]
    });

    expect(records.map(record => record.attribution?.agent_id)).toEqual([
      'ent(agent|client_family|claude-code)',
      'ent(agent|client_family|claude-code)',
      'ent(agent|client_family|codex)'
    ]);
    expect(fake.requests[0]?.filter(request => request.kind == 'agent')).toEqual([
      expect.objectContaining({
        identifiers: [{ type: 'client_family', value: 'claude-code' }]
      }),
      expect.objectContaining({ identifiers: [{ type: 'client_family', value: 'codex' }] })
    ]);
  });

  it('creates an ephemeral device per token and client ip, owned by the token user', async () => {
    let { records, fake } = await run({
      principal: { binding: { deviceId: undefined, deviceMode: 'ephemeral' } },
      clientIp: '2001:db8:1:2::/64',
      drafts: [{}, {}]
    });

    let key = 'device|ip|atit_unit|2001:db8:1:2::/64';

    expect(records.map(record => record.attribution?.device_id)).toEqual([
      `ent(${key})`,
      `ent(${key})`
    ]);
    expect(fake.requests[0]?.find(request => request.kind == 'device')).toEqual({
      key,
      kind: 'device',
      identifiers: [{ type: 'ip', value: 'atit_unit:2001:db8:1:2::/64' }],
      name: '2001:db8:1:2::/64',
      attributes: { ephemeral: true, ip: '2001:db8:1:2::/64', tokenId: 'atit_unit' }
    });
    expect(fake.links).toEqual([
      { fromId: `ent(${key})`, toId: 'aten_user_unit', type: 'owned_by' }
    ]);
  });

  it('leaves the device empty when no client ip is known', async () => {
    let { records } = await run({
      principal: { binding: { deviceId: undefined, deviceMode: 'ephemeral' } },
      drafts: [{}]
    });

    expect(records[0]?.attribution?.device_id).toBeUndefined();
    expect(records[0]?.attribution?.user_id).toBe('aten_user_unit');
  });

  it('resolves client users and installations with their links', async () => {
    let { records, fake } = await run({
      drafts: [
        {
          actor: {
            install_id: 'inst-1',
            user: { id: 'acct-1', email: 'Dev@Example.com' },
            identity_source: 'client_claim'
          }
        }
      ]
    });

    expect(records[0]?.attribution).toMatchObject({
      client_user_id: 'ent(client_user|account:claude-code|acct-1)',
      client_installation_id: 'ent(client_installation|install:claude-code|inst-1)'
    });
    expect(
      fake.requests[0]?.find(request => request.kind == 'client_user')?.identifiers
    ).toEqual([
      { type: 'account:claude-code', value: 'acct-1' },
      { type: 'email:claude-code', value: 'dev@example.com' }
    ]);
    expect(fake.links).toEqual([
      {
        fromId: 'ent(client_user|account:claude-code|acct-1)',
        toId: 'aten_user_unit',
        type: 'owned_by'
      },
      {
        fromId: 'ent(client_installation|install:claude-code|inst-1)',
        toId: 'aten_device_unit',
        type: 'part_of'
      }
    ]);
  });

  it('warns when the client email is not one of the token user emails', async () => {
    let actor = (email: string) => ({
      actor: { user: { email }, identity_source: 'client_claim' as const }
    });
    let fake = createFakeResolver({ userEmails: { aten_user_unit: ['dev@example.com'] } });

    let { records } = await run({
      fake,
      drafts: [actor('DEV@example.com'), actor('other@example.com')]
    });

    expect(records[0]?.quality.warnings).not.toContain(clientEmailConflictWarning);
    expect(records[1]?.quality.warnings).toContain(clientEmailConflictWarning);
  });

  it('does not warn when the token user has no known email', async () => {
    let { records } = await run({
      drafts: [{ actor: { user: { email: 'a@b.co' }, identity_source: 'client_claim' } }]
    });

    expect(records[0]?.quality.warnings).not.toContain(clientEmailConflictWarning);
  });

  it('resolves repos and workspaces from session.context records and links them', async () => {
    let { records, fake } = await run({
      drafts: [
        {
          ...contextRecord({
            repo: { provider: 'github.com', owner: 'metorial', name: 'platform' }
          }),
          content: [{ role: 'path', value: '/Users/dev/platform' }]
        },
        {}
      ]
    });

    let rootHash = (records[0]?.data as SessionContextData).workspace!.root_hash;

    expect(records[0]?.attribution).toMatchObject({
      repo_id: 'ent(repo|remote|github.com/metorial/platform)',
      workspace_id: `ent(workspace|root|${rootHash})`
    });
    expect(records[1]?.attribution?.repo_id).toBeUndefined();
    expect(fake.requests[0]?.find(request => request.kind == 'repo')).toMatchObject({
      name: 'metorial/platform',
      attributes: { provider: 'github.com', owner: 'metorial', name: 'platform' }
    });
    expect(fake.links).toContainEqual({
      fromId: `ent(workspace|root|${rootHash})`,
      toId: 'ent(repo|remote|github.com/metorial/platform)',
      type: 'part_of'
    });
  });

  it('emits credential tags once per session as a session.context record', async () => {
    let fake = createFakeResolver();
    let principal: PrincipalOverrides = {
      tags: [
        { key: 'metorial.team', value: 'payments' },
        { key: 'metorial.user.ref', value: 'ignored' }
      ]
    };

    let first = await run({
      fake,
      principal,
      drafts: [{}, {}, { ctx: { sessionId: 's-2' } }, { ctx: {} }]
    });
    let second = await run({ fake, principal, drafts: [{}] });

    let tagRecords = (records: NormalizedRecord[]) =>
      records.filter(record => record.source.adapter == 'metorial');

    expect(tagRecords(first.records)).toHaveLength(2);
    expect(tagRecords(second.records)).toHaveLength(0);

    let [tagRecord] = tagRecords(first.records);

    expect(tagRecord).toMatchObject({
      type: 'session.context',
      source: { adapter: 'metorial', dialect: 'credential', channel: 'hook' },
      ctx: { session_id: 's-1', session_key: first.records[0]?.ctx.session_key },
      data: {
        source: 'credential',
        tags: [{ k: 'metorial.team', v: 'payments', origin: 'source' }]
      },
      attribution: { user_id: 'aten_user_unit' }
    });
    expect(tagRecord?.source.fact_key).toMatch(/^context:/);
    expect(fake.claims).toContain(
      sourceTagsClaimKey(first.records[0]!.ctx.session_key!, 'atit_unit')
    );
  });

  describe('vendor sources', () => {
    let vendor: PrincipalOverrides = {
      credential: { kind: 'source', id: 'atis_unit', family: 'cursor' },
      binding: { userId: undefined, deviceId: undefined, deviceMode: 'vendor' },
      newUserLimitPerDay: 25
    };

    it('matches users by email and account and counts new ones against the source limit', async () => {
      let { records, fake } = await run({
        principal: vendor,
        drafts: [
          {
            client: { family: 'cursor' },
            actor: {
              install_id: 'machine-1',
              user: { id: 'u-9', email: 'Dev@Acme.com' },
              identity_source: 'client_claim'
            }
          }
        ]
      });

      expect(records[0]?.attribution).toMatchObject({
        user_id: 'ent(user|email|dev@acme.com)',
        device_id: 'ent(device|install:cursor|machine-1)',
        client_user_id: 'ent(client_user|account:cursor|u-9)'
      });
      expect(fake.requests[0]?.find(request => request.kind == 'user')).toEqual({
        key: 'user|email|dev@acme.com',
        kind: 'user',
        identifiers: [
          { type: 'email', value: 'dev@acme.com' },
          { type: 'account:cursor', value: 'u-9' }
        ],
        needsReview: false,
        newUser: { sourceId: 'atis_unit', limitPerDay: 25 }
      });
    });

    it('flags users outside the allowed email domains for review', async () => {
      let { fake } = await run({
        principal: {
          ...vendor,
          organization: { settings: { allowedEmailDomains: ['acme.com'] } }
        },
        drafts: [
          {
            client: { family: 'cursor' },
            actor: { user: { email: 'x@gmail.com' }, identity_source: 'client_claim' }
          },
          {
            client: { family: 'cursor' },
            actor: { user: { email: 'y@acme.com' }, identity_source: 'client_claim' }
          }
        ]
      });

      let users = fake.requests[0]?.filter(request => request.kind == 'user');

      expect(users?.map(user => [user.key, user.needsReview])).toEqual([
        ['user|email|x@gmail.com', true],
        ['user|email|y@acme.com', false]
      ]);
    });

    it('never raises the client email conflict for vendor feeds', async () => {
      let { records } = await run({
        principal: vendor,
        drafts: [
          {
            client: { family: 'cursor' },
            actor: { user: { email: 'x@acme.com' }, identity_source: 'client_claim' }
          }
        ]
      });

      expect(records[0]?.quality.warnings).not.toContain(clientEmailConflictWarning);
    });
  });
});

describe('planAttribution', () => {
  it('requests each distinct identity once per batch', () => {
    let principal = unitPrincipal();
    let records = Array.from({ length: 50 }, () =>
      buildDraft(
        draft({
          actor: { user: { id: 'acct-1' }, install_id: 'i-1', identity_source: 'client_claim' }
        }),
        { principal }
      )
    );

    let plan = planAttribution({ principal, records });

    expect(plan.requests.map(request => request.kind).sort()).toEqual([
      'agent',
      'client_installation',
      'client_user'
    ]);
    expect(plan.links).toHaveLength(2);
  });

  it('skips identifiers that cannot be stored', () => {
    let principal = unitPrincipal();
    let record = buildDraft(
      draft({
        actor: {
          user: { id: 'x'.repeat(600), email: 'not-an-email' },
          identity_source: 'client_claim'
        }
      }),
      { principal }
    );

    expect(planAttribution({ principal, records: [record] }).requests).toEqual([
      expect.objectContaining({ kind: 'agent' })
    ]);
  });
});

describe('emailDomainAllowed', () => {
  it('allows everything without a domain list', () => {
    expect(emailDomainAllowed('a@b.com', undefined)).toBe(true);
    expect(emailDomainAllowed('a@b.com', [])).toBe(true);
  });

  it('matches the exact domain case-insensitively', () => {
    expect(emailDomainAllowed('a@acme.com', ['ACME.com'])).toBe(true);
    expect(emailDomainAllowed('a@sub.acme.com', ['acme.com'])).toBe(false);
    expect(emailDomainAllowed('a@evilacme.com', ['acme.com'])).toBe(false);
  });
});
