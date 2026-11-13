import { describe, expect, it } from 'vitest';
import type { GraphLink } from '../../entities/graph';
import { builtInKinds, customKindTagOrigins } from '../../entities/kinds';
import type { SessionTag } from '../../store/derivedModels';
import type { AttributionRuleMatch } from '../../types';
import { entriesToDims, resolveAttribution, slugKey, tagKindKey } from '../resolver';
import type {
  AttributionEntity,
  AttributionKind,
  AttributionRuleDefinition,
  AttributionSession,
  ResolveAttributionInput
} from '../types';

let at = new Date('2026-11-10T12:00:00Z');

let kinds = new Map<string, AttributionKind>(
  builtInKinds.map(kind => [
    kind.key,
    { key: kind.key, cardinality: kind.cardinality, tagOrigins: kind.tagOrigins }
  ])
);
kinds.set('custom:product', {
  key: 'custom:product',
  cardinality: 'single',
  tagOrigins: customKindTagOrigins
});

let entity = (
  id: string,
  kind: string,
  extra: Partial<AttributionEntity> = {}
): AttributionEntity => ({
  id,
  kind,
  status: 'managed',
  slug: null,
  source: null,
  scopeProjectId: null,
  scopeInstanceId: null,
  identifiers: [],
  ...extra
});

let link = (
  id: string,
  type: string,
  from: AttributionEntity,
  to: AttributionEntity,
  weight: number | null = null
): GraphLink => ({
  id,
  type,
  fromId: from.id,
  fromKind: from.kind,
  toId: to.id,
  toKind: to.kind,
  weight,
  validFrom: new Date(0),
  validTo: null
});

let tag = (k: string, v: string, origin: SessionTag['origin'] = 'source'): SessionTag => ({
  k,
  v,
  origin
});

let rule = (
  id: string,
  target: AttributionEntity,
  match: AttributionRuleMatch,
  extra: Partial<AttributionRuleDefinition> = {}
): AttributionRuleDefinition => ({
  id,
  effect: 'assign',
  priority: 0,
  targetId: target.id,
  scopeProjectId: null,
  scopeInstanceId: null,
  validFrom: new Date(0),
  match,
  ...extra
});

let ada = entity('ada', 'user', { slug: 'ada@acme.com' });
let grace = entity('grace', 'user', { slug: 'grace@acme.com' });
let mac = entity('mac', 'device');
let ciRunner = entity('runner', 'device', { source: 'ephemeral' });
let apiRepo = entity('repo_api', 'repo', {
  identifiers: [{ type: 'remote', value: 'github/acme/api' }]
});
let payments = entity('team_payments', 'team', { slug: 'payments' });
let growth = entity('team_growth', 'team', { slug: 'growth' });
let checkout = entity('prj_checkout', 'project', { slug: 'checkout' });
let billing = entity('prj_billing', 'project', { slug: 'billing' });
let platform = entity('prj_platform', 'project', { slug: 'platform' });
let ledger = entity('prj_ledger', 'project', { slug: 'ledger' });
let finance = entity('cc_finance', 'cost_center', { slug: 'finance' });
let rnd = entity('cc_rnd', 'cost_center', { slug: 'rnd' });
let widget = entity('prod_widget', 'custom:product', { slug: 'widget' });
let reviewer = entity('agt_reviewer', 'agent');

let allEntities = [
  ada,
  grace,
  mac,
  ciRunner,
  apiRepo,
  payments,
  growth,
  checkout,
  billing,
  platform,
  ledger,
  finance,
  rnd,
  widget,
  reviewer
];

let session = (
  overrides: {
    observed?: Partial<AttributionSession['observed']>;
    context?: Partial<AttributionSession['context']>;
  } & Partial<Omit<AttributionSession, 'observed' | 'context'>> = {}
): AttributionSession => ({
  projectId: 'gs_project',
  instanceId: 'gs_instance',
  startedAt: at,
  client: { family: 'claude-code' },
  ...overrides,
  observed: {
    userId: ada.id,
    deviceId: mac.id,
    clientUserIds: [],
    clientInstallationIds: [],
    ...overrides.observed
  },
  context: {
    workspaceIds: [],
    repoIds: [],
    ticketRefs: [],
    tags: [],
    pathStored: false,
    ...overrides.context
  }
});

let input = (d: Partial<ResolveAttributionInput> & { session: AttributionSession }) => {
  let entities = d.entities ?? new Map(allEntities.map(item => [item.id, item]));
  let slugs = new Map(
    [...entities.values()]
      .filter(item => item.slug)
      .map(item => [slugKey(item.kind, item.slug!), item.id])
  );

  return {
    kinds,
    entities,
    slugs,
    emails: new Map([
      ['ada@acme.com', ada.id],
      ['grace@acme.com', grace.id]
    ]),
    rules: [],
    links: [],
    managedKinds: [],
    ...d
  } satisfies ResolveAttributionInput;
};

let entryOf = (result: ReturnType<typeof resolveAttribution>, kind: string) =>
  result.entries.filter(entry => entry.kind == kind);

let idsOf = (result: ReturnType<typeof resolveAttribution>, kind: string) =>
  entryOf(result, kind).map(entry => entry.entityId);

describe('tagKindKey', () => {
  it('maps metorial tags to kinds', () => {
    expect(tagKindKey('metorial.project')).toBe('project');
    expect(tagKindKey('Metorial.Custom.Product')).toBe('custom:product');
    expect(tagKindKey('metorial.initiator')).toBeNull();
    expect(tagKindKey('team')).toBeNull();
  });
});

describe('resolveAttribution', () => {
  it('takes user and device from the observed principal and never overrides them', () => {
    let result = resolveAttribution(
      input({
        session: session({
          manual: [{ kind: 'user', entityId: grace.id, at }],
          context: { tags: [tag('metorial.user', 'grace@acme.com')] }
        }),
        rules: [rule('r1', grace, { field: 'client.family', op: 'exists' })]
      })
    );

    expect(entryOf(result, 'user')).toEqual([
      { kind: 'user', entityId: ada.id, role: 'principal', source: 'observed', weight: 1 }
    ]);
    expect(entryOf(result, 'device')).toEqual([
      { kind: 'device', entityId: mac.id, source: 'observed', weight: 1 }
    ]);
    expect(result.entries[0]!.kind).toBe('user');
    expect(entriesToDims(result.entries).some(dim => dim.kind == 'user')).toBe(false);
  });

  it('applies precedence manual > tag > rule > derived for a single-valued kind', () => {
    let links = [link('l1', 'part_of', apiRepo, ledger)];
    let rules = [rule('r1', platform, { field: 'repo.owner', op: 'eq', value: 'acme' })];
    let base = {
      repoIds: [apiRepo.id],
      tags: [tag('metorial.project', 'billing')]
    };

    let manual = resolveAttribution(
      input({
        session: session({
          context: base,
          manual: [{ kind: 'project', entityId: checkout.id, at }]
        }),
        rules,
        links
      })
    );
    expect(entryOf(manual, 'project')).toEqual([
      expect.objectContaining({ entityId: checkout.id, source: 'manual', weight: 1 })
    ]);

    let tagged = resolveAttribution(
      input({ session: session({ context: base }), rules, links })
    );
    expect(entryOf(tagged, 'project')).toEqual([
      expect.objectContaining({ entityId: billing.id, source: 'tag' })
    ]);

    let ruled = resolveAttribution(
      input({ session: session({ context: { repoIds: [apiRepo.id] } }), rules, links })
    );
    expect(entryOf(ruled, 'project')).toEqual([
      expect.objectContaining({ entityId: platform.id, source: 'rule', ruleId: 'r1' })
    ]);
    expect(ruled.matchedRuleIds).toEqual(['r1']);

    let derived = resolveAttribution(
      input({ session: session({ context: { repoIds: [apiRepo.id] } }), links })
    );
    expect(entryOf(derived, 'project')).toEqual([
      expect.objectContaining({ entityId: ledger.id, source: 'derived', via: [apiRepo.id] })
    ]);
  });

  it('marks an agent bound to the credential as credential-sourced', () => {
    let observed = resolveAttribution(
      input({ session: session({ observed: { agentId: reviewer.id } }) })
    );
    let credential = resolveAttribution(
      input({
        session: session({ observed: { agentId: reviewer.id } }),
        credentialAgent: true
      })
    );

    expect(entryOf(observed, 'agent')[0]?.source).toBe('observed');
    expect(entryOf(credential, 'agent')[0]?.source).toBe('credential');
  });

  it('only honours tags from origins the kind allows', () => {
    let result = resolveAttribution(
      input({
        session: session({
          context: {
            tags: [
              tag('metorial.project', 'billing', 'repo'),
              tag('metorial.team', 'payments', 'repo'),
              tag('metorial.cost_center', 'finance', 'environment'),
              tag('metorial.custom.product', 'widget', 'repo'),
              tag('metorial.project', 'unknown-slug')
            ]
          }
        })
      })
    );

    expect(idsOf(result, 'project')).toEqual([billing.id]);
    expect(idsOf(result, 'team')).toEqual([]);
    expect(idsOf(result, 'cost_center')).toEqual([]);
    expect(idsOf(result, 'custom:product')).toEqual([widget.id]);
  });

  it('keeps one value for single kinds and all values for multi kinds', () => {
    let links = [link('l1', 'member_of', ada, payments), link('l2', 'member_of', ada, growth)];

    let result = resolveAttribution(
      input({
        session: session({
          context: {
            tags: [tag('metorial.project', 'checkout'), tag('metorial.project', 'billing')]
          }
        }),
        links
      })
    );

    expect(entryOf(result, 'project')).toEqual([
      expect.objectContaining({ entityId: billing.id, weight: 1 })
    ]);
    expect(entryOf(result, 'team')).toEqual([
      expect.objectContaining({ entityId: growth.id, source: 'derived', weight: 0.5 }),
      expect.objectContaining({ entityId: payments.id, source: 'derived', weight: 0.5 })
    ]);
  });

  it('normalizes multi-valued weights when explicit and derived values add up past 1', () => {
    let result = resolveAttribution(
      input({
        session: session({ context: { tags: [tag('metorial.team', 'payments')] } }),
        links: [link('l1', 'member_of', ada, growth, 0.5)]
      })
    );

    let teams = entryOf(result, 'team');
    expect(teams.map(entry => [entry.entityId, entry.weight])).toEqual([
      [growth.id, 0.333333],
      [payments.id, 0.666667]
    ]);
  });

  it('breaks rule ties by priority and lets exclude win at equal priority', () => {
    let match: AttributionRuleMatch = {
      field: 'client.family',
      op: 'eq',
      value: 'claude-code'
    };

    let byPriority = resolveAttribution(
      input({
        session: session(),
        rules: [
          rule('r_low', checkout, match, { priority: 1 }),
          rule('r_high', billing, match, { priority: 5 })
        ]
      })
    );
    expect(entryOf(byPriority, 'project')).toEqual([
      expect.objectContaining({ entityId: billing.id, ruleId: 'r_high' })
    ]);

    let excluded = resolveAttribution(
      input({
        session: session(),
        rules: [
          rule('r_assign', checkout, match),
          rule('r_exclude', checkout, match, { effect: 'exclude' })
        ]
      })
    );
    expect(idsOf(excluded, 'project')).toEqual([]);
  });

  it('applies a rule only to sessions that started at or after its validFrom', () => {
    let match: AttributionRuleMatch = { field: 'client.family', op: 'exists' };
    let resolve = (validFrom: Date) =>
      resolveAttribution(
        input({ session: session(), rules: [rule('r1', billing, match, { validFrom })] })
      );

    expect(idsOf(resolve(at), 'project')).toEqual([billing.id]);
    expect(idsOf(resolve(new Date(at.getTime() + 1)), 'project')).toEqual([]);
    expect(resolve(new Date(at.getTime() + 1)).matchedRuleIds).toEqual([]);
  });

  it('evaluates rules against derived teams and entity identifiers', () => {
    let result = resolveAttribution(
      input({
        session: session({ context: { repoIds: [apiRepo.id] } }),
        links: [link('l1', 'member_of', ada, payments)],
        rules: [
          rule('r1', finance, {
            all: [
              { field: 'team', op: 'eq', value: 'payments' },
              { field: 'repo', op: 'glob', value: 'github/acme/*' },
              { field: 'user', op: 'glob', value: '*@acme.com' }
            ]
          })
        ]
      })
    );

    expect(entryOf(result, 'cost_center')).toEqual([
      expect.objectContaining({ entityId: finance.id, source: 'rule' })
    ]);
  });

  it('records the derivation path and prefers project paths over team paths', () => {
    let links = [
      link('l1', 'member_of', ada, payments),
      link('l2', 'part_of', payments, rnd),
      link('l3', 'part_of', apiRepo, ledger),
      link('l4', 'part_of', ledger, finance)
    ];

    let teamOnly = resolveAttribution(input({ session: session(), links }));
    expect(entryOf(teamOnly, 'cost_center')).toEqual([
      expect.objectContaining({ entityId: rnd.id, via: [ada.id, payments.id], weight: 1 })
    ]);

    let both = resolveAttribution(
      input({ session: session({ context: { repoIds: [apiRepo.id] } }), links })
    );
    expect(entryOf(both, 'cost_center')).toEqual([
      expect.objectContaining({ entityId: finance.id, via: [apiRepo.id, ledger.id] })
    ]);
  });

  it('drops derivations that run through an entity that lost its kind or was excluded', () => {
    let links = [
      link('l1', 'part_of', apiRepo, ledger),
      link('l2', 'part_of', ledger, finance),
      link('l3', 'member_of', ada, payments),
      link('l4', 'part_of', payments, rnd)
    ];

    let lost = resolveAttribution(
      input({
        session: session({
          observed: { userId: grace.id },
          context: { repoIds: [apiRepo.id], tags: [tag('metorial.project', 'billing')] }
        }),
        links
      })
    );
    expect(idsOf(lost, 'project')).toEqual([billing.id]);
    expect(idsOf(lost, 'cost_center')).toEqual([]);

    let excluded = resolveAttribution(
      input({
        session: session(),
        links,
        rules: [
          rule('r1', payments, { field: 'client.family', op: 'exists' }, { effect: 'exclude' })
        ]
      })
    );
    expect(idsOf(excluded, 'team')).toEqual([]);
    expect(idsOf(excluded, 'cost_center')).toEqual([]);
  });

  it('uses the classifier only for kinds nothing else resolved', () => {
    let classification = {
      status: 'accepted' as const,
      runs: 1,
      at,
      results: [
        {
          kind: 'project',
          stage: 'clef' as const,
          candidates: [{ entityId: checkout.id, confidence: 0.9 }],
          accepted: { entityId: checkout.id, confidence: 0.9 }
        }
      ]
    };

    let empty = resolveAttribution(input({ session: session({ classification }) }));
    expect(entryOf(empty, 'project')).toEqual([
      expect.objectContaining({ entityId: checkout.id, source: 'classifier', confidence: 0.9 })
    ]);

    let tagged = resolveAttribution(
      input({
        session: session({
          classification,
          context: { tags: [tag('metorial.project', 'billing')] }
        })
      })
    );
    expect(entryOf(tagged, 'project')).toEqual([
      expect.objectContaining({ entityId: billing.id, source: 'tag' })
    ]);
  });

  it('clears a kind assigned manually to nothing', () => {
    let result = resolveAttribution(
      input({
        session: session({
          manual: [{ kind: 'project', entityId: null, at }],
          context: { repoIds: [apiRepo.id], tags: [tag('metorial.project', 'billing')] }
        }),
        links: [link('l1', 'part_of', apiRepo, ledger)]
      })
    );

    expect(idsOf(result, 'project')).toEqual([]);
  });

  it('adds an initiator from a source tag, or an environment tag on CI devices', () => {
    let fromSource = resolveAttribution(
      input({
        session: session({ context: { tags: [tag('metorial.initiator', 'Grace@Acme.com')] } })
      })
    );
    expect(entryOf(fromSource, 'user')).toEqual([
      expect.objectContaining({ entityId: ada.id, role: 'principal' }),
      expect.objectContaining({ entityId: grace.id, role: 'initiator', source: 'tag' })
    ]);

    let envOnLaptop = resolveAttribution(
      input({
        session: session({
          context: { tags: [tag('metorial.initiator', 'grace@acme.com', 'environment')] }
        })
      })
    );
    expect(idsOf(envOnLaptop, 'user')).toEqual([ada.id]);

    let envOnCi = resolveAttribution(
      input({
        session: session({
          observed: { deviceId: ciRunner.id },
          context: { tags: [tag('metorial.initiator', 'grace@acme.com', 'environment')] }
        })
      })
    );
    expect(idsOf(envOnCi, 'user')).toEqual([ada.id, grace.id]);
  });

  it('ignores entities scoped to another project', () => {
    let scoped = entity('prj_scoped', 'project', { slug: 'scoped', scopeProjectId: 'other' });
    let entities = new Map([...allEntities, scoped].map(item => [item.id, item]));

    let result = resolveAttribution(
      input({
        session: session({ context: { tags: [tag('metorial.project', 'scoped')] } }),
        entities
      })
    );

    expect(idsOf(result, 'project')).toEqual([]);
  });

  it('skips rules for sessionless usage', () => {
    let result = resolveAttribution(
      input({
        session: session(),
        rules: [rule('r1', billing, { field: 'client.family', op: 'exists' })],
        sessionless: true
      })
    );

    expect(idsOf(result, 'project')).toEqual([]);
    expect(result.matchedRuleIds).toEqual([]);
  });

  it('reports full attribution, dim ids and a stable inputs hash', () => {
    let build = (tags: SessionTag[]) =>
      resolveAttribution(
        input({
          session: session({ context: { tags } }),
          managedKinds: ['project', 'team']
        })
      );

    let partial = build([tag('metorial.project', 'billing')]);
    expect(partial.fullyAttributed).toBe(false);

    let full = build([tag('metorial.project', 'billing'), tag('metorial.team', 'payments')]);
    expect(full.fullyAttributed).toBe(true);
    expect(full.dimIds).toEqual([
      ada.id,
      mac.id,
      billing.id,
      payments.id,
      'gs_project',
      'gs_instance'
    ]);

    expect(build([tag('metorial.project', 'billing')]).inputsHash).toBe(partial.inputsHash);
    expect(full.inputsHash).not.toBe(partial.inputsHash);
  });
});
