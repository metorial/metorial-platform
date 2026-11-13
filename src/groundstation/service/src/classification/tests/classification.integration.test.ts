import mongoose from 'mongoose';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestReattribution } from '../../attribution/reattribute';
import { reattributeSession } from '../../attribution/session';
import { findOrCreateDiscovered } from '../../entities/resolve';
import { entityService, instanceService } from '../../services';
import { getStore } from '../../store/connection';
import { contentAad, createContentCipher } from '../../store/contentCipher';
import type { SessionDocument } from '../../store/derivedModels';
import { expectServiceError } from '../../test/helpers';
import { createTestScope } from '../../test/scope';
import { cleanDatabase, testDb } from '../../test/setup';
import type { InstanceSettings } from '../../types';
import { createClefClient, type ClefFetch, type ClefRequest } from '../clef';
import { classifySession } from '../run';
import { learnedLinkConfirmations, sessionClassificationService } from '../service';
import { sessionDocument } from './fixtures';

vi.mock('../../attribution/session', () => ({
  reattributeSession: vi.fn(async () => {})
}));
vi.mock('../../attribution/reattribute', () => ({
  requestReattribution: vi.fn(async () => {})
}));

let store = getStore();
let cipher = createContentCipher('classification-content-secret');

let collections = async () => {
  await store.ready();
  return store.collections();
};

let setup = async (settings: InstanceSettings = {}) => {
  let scope = await createTestScope({ instance: { settings } });

  let addProject = (input: {
    ref: string;
    name: string;
    attributes?: Record<string, unknown>;
    scope?: { instanceId: string };
  }) =>
    entityService.upsertEntity({
      organization: scope.organization,
      input: { kind: 'project', ...input }
    });

  let discovered = async (kind: 'repo' | 'workspace', value: string, name: string) =>
    (
      await findOrCreateDiscovered({
        organization: scope.organization,
        kind,
        name,
        identifiers: [{ type: kind == 'repo' ? 'remote' : 'root_hash', value }]
      })
    ).entity;

  let session = async (overrides: Partial<SessionDocument> = {}) => {
    let key = crypto.randomUUID().replace(/-/g, '');
    let document = sessionDocument({
      _id: key,
      rootSessionKey: key,
      organizationId: scope.organization.id,
      projectId: scope.project.id,
      instanceId: scope.instance.id,
      ...overrides
    });

    await (await collections()).sessions.insertOne(document);

    return document;
  };

  let reload = async (sessionKey: string) =>
    (await (await collections()).sessions.findOne({ _id: sessionKey }))!;

  return { ...scope, addProject, discovered, session, reload };
};

let clefAnswering = (
  probabilities: (request: ClefRequest) => Record<string, Record<string, number>>
) => {
  let requests: ClefRequest[] = [];

  let fetch: ClefFetch = async (_url, init) => {
    let request = JSON.parse(init.body as string) as ClefRequest;
    requests.push(request);

    let answers = Object.fromEntries(
      Object.entries(probabilities(request)).map(([questionId, options]) => {
        let [choice, confidence] = Object.entries(options).sort((a, b) => b[1] - a[1])[0]!;
        return [questionId, { type: 'choice', choice, confidence, probabilities: options }];
      })
    );

    return new Response(
      JSON.stringify({ result: { answers, usage: { input_tokens: 100 } }, success: true }),
      { status: 200 }
    );
  };

  return { requests, clef: createClefClient({ accountId: 'acct', apiToken: 'token', fetch }) };
};

let context = (overrides: Partial<SessionDocument['context']> = {}) => ({
  workspaceIds: [],
  repoIds: [],
  ticketRefs: [],
  tags: [],
  pathStored: false,
  ...overrides
});

let aiSettings: InstanceSettings = { classification: { ai: { enabled: true } } };

describe('session classification', () => {
  beforeEach(async () => {
    await cleanDatabase();
    vi.mocked(reattributeSession).mockClear();
    vi.mocked(requestReattribution).mockClear();
  });

  afterAll(async () => {
    await store.close();
  });

  describe('ticket refs', () => {
    it('accepts a unique ticket prefix match and re-resolves attribution', async () => {
      let { addProject, session, reload } = await setup();
      let billing = await addProject({
        ref: 'billing',
        name: 'Billing',
        attributes: { ticketPrefixes: ['BILL'] }
      });
      await addProject({ ref: 'web', name: 'Web', attributes: { ticketPrefixes: ['WEB'] } });

      let created = await session({ context: context({ ticketRefs: ['bill-12'] }) });

      let outcome = await classifySession({
        sessionKey: created._id,
        reason: 'turn_completed',
        clef: null
      });

      expect(outcome).toEqual({ status: 'accepted', clefCalled: false });

      let stored = await reload(created._id);
      expect(stored.classification).toMatchObject({
        status: 'accepted',
        runs: 1,
        clefCalls: 0,
        results: [
          {
            kind: 'project',
            stage: 'ticket',
            accepted: { entityId: billing.id, confidence: 0.95 }
          }
        ]
      });
      expect(reattributeSession).toHaveBeenCalledWith({ sessionKey: created._id });

      expect(
        await classifySession({ sessionKey: created._id, reason: 'idle', clef: null })
      ).toEqual({ status: 'not_due', clefCalled: false });
    });

    it('skips kinds another source already resolved', async () => {
      let { addProject, session, reload } = await setup();
      let billing = await addProject({
        ref: 'billing',
        name: 'Billing',
        attributes: { ticketPrefixes: ['BILL'] }
      });

      let created = await session({
        context: context({ ticketRefs: ['BILL-1'] }),
        attribution: {
          entries: [{ kind: 'project', entityId: billing.id, source: 'derived', weight: 1 }],
          dimIds: [],
          version: 1,
          inputsHash: '',
          computedAt: new Date()
        }
      });

      await classifySession({ sessionKey: created._id, reason: 'turn_completed', clef: null });

      expect((await reload(created._id)).classification).toMatchObject({
        status: 'skipped',
        results: []
      });
    });

    it('skips everything when classification is off for the instance', async () => {
      let { addProject, session, reload } = await setup({
        classification: { enabled: false }
      });
      await addProject({
        ref: 'billing',
        name: 'Billing',
        attributes: { ticketPrefixes: ['BILL'] }
      });

      let created = await session({ context: context({ ticketRefs: ['BILL-1'] }) });
      await classifySession({ sessionKey: created._id, reason: 'turn_completed', clef: null });

      expect((await reload(created._id)).classification).toMatchObject({
        status: 'skipped',
        runs: 1,
        results: []
      });
    });

    it('only picks entities of the organization whose scope contains the session', async () => {
      let { organization, project, addProject, session, reload } = await setup();
      let otherInstance = await instanceService.upsertInstance({
        organization,
        project,
        input: { ref: crypto.randomUUID() }
      });
      await addProject({
        ref: 'scoped',
        name: 'Scoped',
        attributes: { ticketPrefixes: ['BILL'] },
        scope: { instanceId: otherInstance.id }
      });

      let other = await createTestScope();
      await entityService.upsertEntity({
        organization: other.organization,
        input: { kind: 'project', ref: 'billing', attributes: { ticketPrefixes: ['BILL'] } }
      });

      let created = await session({ context: context({ ticketRefs: ['BILL-1'] }) });
      await classifySession({ sessionKey: created._id, reason: 'turn_completed', clef: null });

      expect((await reload(created._id)).classification?.status).toBe('skipped');
    });
  });

  describe('clef', () => {
    it('classifies with clef when the deterministic stages have no answer', async () => {
      let { addProject, discovered, session, reload } = await setup(aiSettings);
      let billing = await addProject({
        ref: 'billing',
        name: 'Billing',
        attributes: { description: 'Invoices and payments', repos: ['acme/billing-api'] }
      });
      let web = await addProject({ ref: 'web', name: 'Web' });
      let repo = await discovered('repo', 'github.com/acme/billing-api', 'acme/billing-api');

      let created = await session({
        context: context({ repoIds: [repo.id], branch: 'fix-invoice-rounding' }),
        attribution: {
          entries: [{ kind: 'repo', entityId: repo.id, source: 'observed', weight: 1 }],
          dimIds: [repo.id],
          version: 1,
          inputsHash: '',
          computedAt: new Date()
        }
      });

      let { clef, requests } = clefAnswering(() => ({
        project: { [billing.id]: 0.93, [web.id]: 0.04, none: 0.03 }
      }));

      let outcome = await classifySession({
        sessionKey: created._id,
        reason: 'turn_completed',
        clef,
        cipher
      });

      expect(outcome).toEqual({ status: 'accepted', clefCalled: true });
      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({
        model: 'clef',
        state: { repo: 'acme/billing-api', branch: 'fix-invoice-rounding' },
        questions: {
          project: {
            type: 'choice',
            criteria: {
              [billing.id]: 'Billing — Invoices and payments; repos: acme/billing-api',
              [web.id]: 'Web',
              none: 'None of these'
            }
          }
        }
      });
      expect(Object.keys(requests[0]!.questions)).toEqual(['project']);
      expect(requests[0]!.state).not.toHaveProperty('path');
      expect(requests[0]!.state).not.toHaveProperty('firstPrompt');

      expect((await reload(created._id)).classification).toMatchObject({
        status: 'accepted',
        clefCalls: 1,
        results: [
          {
            kind: 'project',
            stage: 'clef',
            accepted: { entityId: billing.id, confidence: 0.93 }
          }
        ]
      });
    });

    it('needs review below the threshold and calls clef at most twice', async () => {
      let { addProject, session, reload } = await setup(aiSettings);
      let billing = await addProject({ ref: 'billing', name: 'Billing' });
      let web = await addProject({ ref: 'web', name: 'Web' });

      let created = await session();
      let { clef, requests } = clefAnswering(() => ({
        project: { [billing.id]: 0.55, [web.id]: 0.4, none: 0.05 }
      }));

      await classifySession({ sessionKey: created._id, reason: 'turn_completed', clef });

      let first = (await reload(created._id)).classification!;
      expect(first).toMatchObject({ status: 'needs_review', runs: 1, clefCalls: 1 });
      expect(first.results[0]!.accepted).toBeUndefined();
      expect(first.results[0]!.candidates).toEqual([
        { entityId: billing.id, confidence: 0.55 },
        { entityId: web.id, confidence: 0.4 }
      ]);

      await classifySession({ sessionKey: created._id, reason: 'idle', clef });
      await classifySession({ sessionKey: created._id, reason: 'idle', clef });
      await classifySession({ sessionKey: created._id, reason: 'manual', clef });

      expect(requests).toHaveLength(2);

      let last = (await reload(created._id)).classification!;
      expect(last).toMatchObject({ status: 'needs_review', runs: 3, clefCalls: 2 });
      expect(last.results[0]).toMatchObject({
        stage: 'clef',
        candidates: first.results[0]!.candidates
      });
    });

    it('stays pending when clef fails and does not spend the cap', async () => {
      let { addProject, session, reload } = await setup(aiSettings);
      await addProject({ ref: 'billing', name: 'Billing' });

      let created = await session();
      let clef = createClefClient({
        accountId: 'acct',
        apiToken: 'token',
        retryDelayMs: 1,
        fetch: async () => new Response('{}', { status: 503 })
      });

      let outcome = await classifySession({
        sessionKey: created._id,
        reason: 'turn_completed',
        clef
      });

      expect(outcome).toEqual({ status: 'pending', clefCalled: true });
      expect((await reload(created._id)).classification).toMatchObject({
        status: 'pending',
        clefCalls: 0
      });
    });

    it('does not call clef when the AI stage is off and skips sessions with no candidates', async () => {
      let { addProject, session, reload } = await setup();
      await addProject({ ref: 'billing', name: 'Billing' });

      let created = await session();
      let { clef, requests } = clefAnswering(() => ({}));

      await classifySession({ sessionKey: created._id, reason: 'turn_completed', clef });

      expect(requests).toHaveLength(0);
      expect((await reload(created._id)).classification).toMatchObject({
        status: 'skipped',
        results: [{ kind: 'project', stage: 'prior', candidates: [] }]
      });
    });

    it('re-runs a skipped session on idle once new context arrived', async () => {
      let { addProject, session, reload } = await setup();
      let billing = await addProject({
        ref: 'billing',
        name: 'Billing',
        attributes: { ticketPrefixes: ['BILL'] }
      });

      let created = await session();
      await classifySession({ sessionKey: created._id, reason: 'turn_completed', clef: null });
      expect((await reload(created._id)).classification?.status).toBe('skipped');

      expect(
        await classifySession({ sessionKey: created._id, reason: 'idle', clef: null })
      ).toEqual({ status: 'not_due', clefCalled: false });

      await (
        await collections()
      ).sessions.updateOne(
        { _id: created._id },
        { $set: { 'context.ticketRefs': ['BILL-77'] } }
      );
      await classifySession({ sessionKey: created._id, reason: 'idle', clef: null });

      expect((await reload(created._id)).classification).toMatchObject({
        status: 'accepted',
        runs: 2,
        results: [{ kind: 'project', stage: 'ticket', accepted: { entityId: billing.id } }]
      });
    });

    it('sends the stored path and first prompt only when they were kept in full', async () => {
      let { organization, addProject, session } = await setup(aiSettings);
      let billing = await addProject({ ref: 'billing', name: 'Billing' });

      let created = await session({ context: context({ pathStored: true }) });
      let stored = await collections();
      let key = cipher.forOrganization({ id: organization.id, contentKeyVersion: 1 });

      let insertRecord = async (d: {
        id: string;
        type: string;
        role: 'path' | 'prompt';
        mode: 'full' | 'basic';
        text?: string;
        occurredAt: Date;
      }) => {
        await stored.events.insertOne({
          _id: d.id,
          organizationId: organization.id,
          type: d.type,
          occurredAt: d.occurredAt,
          ctx: { sessionKey: created._id },
          content: [
            {
              role: d.role,
              mode: d.mode,
              state: 'present',
              hasText: d.text ? true : undefined
            }
          ]
        } as any);

        if (!d.text) return;

        let encrypted = cipher.encrypt(
          key,
          d.text,
          contentAad({
            organizationId: organization.id,
            recordId: d.id,
            index: 0,
            role: d.role
          })
        );
        await stored.contentTexts.insertOne({
          _id: `${d.id}:0`,
          organizationId: organization.id,
          recordId: d.id,
          index: 0,
          role: d.role,
          keyVersion: 1,
          iv: new mongoose.mongo.Binary(encrypted.iv),
          ciphertext: new mongoose.mongo.Binary(encrypted.ciphertext)
        } as any);
      };

      let prefix = created._id.slice(0, 8);
      await insertRecord({
        id: `${prefix}-ctx`,
        type: 'session.start',
        role: 'path',
        mode: 'full',
        text: '/Users/dev/acme/billing-api',
        occurredAt: new Date('2026-11-13T10:00:00Z')
      });
      await insertRecord({
        id: `${prefix}-p1`,
        type: 'prompt.submitted',
        role: 'prompt',
        mode: 'basic',
        occurredAt: new Date('2026-11-13T10:00:01Z')
      });
      await insertRecord({
        id: `${prefix}-p2`,
        type: 'prompt.submitted',
        role: 'prompt',
        mode: 'full',
        text: 'Fix the invoice rounding bug',
        occurredAt: new Date('2026-11-13T10:00:02Z')
      });

      let { clef, requests } = clefAnswering(() => ({ project: { [billing.id]: 0.9 } }));
      await classifySession({
        sessionKey: created._id,
        reason: 'turn_completed',
        clef,
        cipher
      });

      expect(requests[0]!.state).toMatchObject({
        path: '/Users/dev/acme/billing-api',
        firstPrompt: 'Fix the invoice rounding bug'
      });

      let unstored = await session({ context: context({ pathStored: false }) });
      await classifySession({
        sessionKey: unstored._id,
        reason: 'turn_completed',
        clef,
        cipher: null
      });

      expect(requests[1]!.state).not.toHaveProperty('path');
      expect(requests[1]!.state).not.toHaveProperty('firstPrompt');
    });
  });

  describe('review and priors', () => {
    it('stores a label on accept that priors use for the next session in the workspace', async () => {
      let { organization, addProject, discovered, session, reload } = await setup();
      let billing = await addProject({ ref: 'billing', name: 'Billing' });
      await addProject({ ref: 'web', name: 'Web' });
      let workspace = await discovered('workspace', 'root-hash-1', 'billing-api');

      let observedWorkspace = {
        entries: [
          { kind: 'workspace', entityId: workspace.id, source: 'observed' as const, weight: 1 }
        ],
        dimIds: [workspace.id],
        version: 1,
        inputsHash: '',
        computedAt: new Date()
      };

      let first = await session({
        context: context({ workspaceIds: [workspace.id] }),
        attribution: observedWorkspace
      });
      await classifySession({ sessionKey: first._id, reason: 'turn_completed', clef: null });
      expect((await reload(first._id)).classification?.status).toBe('skipped');

      let classification = await sessionClassificationService.reviewSession({
        organization,
        session: await sessionClassificationService.getSession({
          organization,
          sessionKey: first._id
        }),
        input: { kind: 'project', action: 'accept', entityId: billing.id }
      });

      expect(classification).toMatchObject({
        status: 'accepted',
        results: [
          {
            kind: 'project',
            accepted: { entityId: billing.id, confidence: 1 },
            review: { action: 'accept', entityId: billing.id }
          }
        ]
      });
      expect(reattributeSession).toHaveBeenLastCalledWith({ sessionKey: first._id });

      let labels = await testDb.classifierLabel.findMany({
        where: { organizationOid: organization.oid }
      });
      expect(labels).toHaveLength(1);
      expect(labels[0]).toMatchObject({
        kind: 'project',
        sessionKey: first._id,
        entityOid: billing.oid,
        features: { workspaceIds: [workspace.id], repoIds: [] }
      });

      let second = await session({
        context: context({ workspaceIds: [workspace.id] }),
        attribution: observedWorkspace
      });
      await classifySession({ sessionKey: second._id, reason: 'turn_completed', clef: null });

      expect((await reload(second._id)).classification).toMatchObject({
        status: 'accepted',
        results: [
          {
            kind: 'project',
            stage: 'prior',
            accepted: { entityId: billing.id, confidence: 0.9 }
          }
        ]
      });
    });

    it('uses manual assignments of other sessions as priors', async () => {
      let { addProject, discovered, session, reload } = await setup();
      let billing = await addProject({ ref: 'billing', name: 'Billing' });
      let repo = await discovered('repo', 'github.com/acme/billing-api', 'acme/billing-api');

      let attribution = {
        entries: [{ kind: 'repo', entityId: repo.id, source: 'observed' as const, weight: 1 }],
        dimIds: [repo.id],
        version: 1,
        inputsHash: '',
        computedAt: new Date()
      };

      await session({
        context: context({ repoIds: [repo.id] }),
        attribution,
        manual: [{ kind: 'project', entityId: billing.id, at: new Date() }]
      });

      let next = await session({ context: context({ repoIds: [repo.id] }), attribution });
      await classifySession({ sessionKey: next._id, reason: 'turn_completed', clef: null });

      expect((await reload(next._id)).classification).toMatchObject({
        status: 'accepted',
        results: [{ stage: 'prior', accepted: { entityId: billing.id, confidence: 0.85 } }]
      });
    });

    it('rejects a suggestion, drops its label and never suggests it again', async () => {
      let { organization, addProject, session, reload } = await setup();
      let billing = await addProject({
        ref: 'billing',
        name: 'Billing',
        attributes: { ticketPrefixes: ['BILL'] }
      });

      let created = await session({ context: context({ ticketRefs: ['BILL-3'] }) });
      await classifySession({ sessionKey: created._id, reason: 'turn_completed', clef: null });

      let classification = await sessionClassificationService.reviewSession({
        organization,
        session: await reload(created._id),
        input: { kind: 'project', action: 'reject' }
      });

      expect(classification.status).toBe('rejected');
      expect(classification.results[0]).toMatchObject({
        rejectedEntityIds: [billing.id],
        review: { action: 'reject', entityId: billing.id }
      });
      expect(classification.results[0]!.accepted).toBeUndefined();

      await classifySession({ sessionKey: created._id, reason: 'manual', clef: null });

      let rerun = (await reload(created._id)).classification!;
      expect(rerun.status).toBe('rejected');
      expect(rerun.results[0]!.rejectedEntityIds).toEqual([billing.id]);
      expect(rerun.results.some(result => result.accepted)).toBe(false);
    });

    it('validates review input', async () => {
      let { organization, addProject, session } = await setup();
      let created = await session();
      let other = await createTestScope();
      let foreign = await entityService.upsertEntity({
        organization: other.organization,
        input: { kind: 'project', ref: 'foreign' }
      });
      let costCenter = await entityService.upsertEntity({
        organization,
        input: { kind: 'cost_center', ref: 'cc' }
      });
      await addProject({ ref: 'billing', name: 'Billing' });

      await expectServiceError(
        sessionClassificationService.getSession({
          organization: other.organization,
          sessionKey: created._id
        }),
        'not_found'
      );
      await expectServiceError(
        sessionClassificationService.reviewSession({
          organization,
          session: created,
          input: { kind: 'user', action: 'accept', entityId: foreign.id }
        }),
        'bad_request'
      );
      await expectServiceError(
        sessionClassificationService.reviewSession({
          organization,
          session: created,
          input: { kind: 'project', action: 'accept', entityId: foreign.id }
        }),
        'not_found'
      );
      await expectServiceError(
        sessionClassificationService.reviewSession({
          organization,
          session: created,
          input: { kind: 'project', action: 'accept', entityId: costCenter.id }
        }),
        'bad_request'
      );
      await expectServiceError(
        sessionClassificationService.reviewSession({
          organization,
          session: created,
          input: { kind: 'project', action: 'reject' }
        }),
        'bad_request'
      );
    });
  });

  describe('learned links', () => {
    it(`links a workspace to the project after ${learnedLinkConfirmations} confirmations`, async () => {
      let { organization, addProject, discovered, session } = await setup();
      let billing = await addProject({ ref: 'billing', name: 'Billing' });
      let workspace = await discovered('workspace', 'root-hash-2', 'billing-api');

      let activeLinks = () =>
        testDb.entityLink.findMany({
          where: { fromOid: workspace.oid, toOid: billing.oid, type: 'part_of', validTo: null }
        });

      for (let index = 1; index <= learnedLinkConfirmations; index++) {
        let created = await session({ context: context({ workspaceIds: [workspace.id] }) });

        await sessionClassificationService.reviewSession({
          organization,
          session: created,
          input: { kind: 'project', action: 'accept', entityId: billing.id }
        });

        expect(await activeLinks()).toHaveLength(index < learnedLinkConfirmations ? 0 : 1);
      }

      let [link] = await activeLinks();
      expect(link).toMatchObject({ origin: 'classifier' });
      expect(requestReattribution).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: organization.id,
          entityIds: [workspace.id, billing.id]
        })
      );
    });

    it('does not learn a link when confirmations disagree', async () => {
      let { organization, addProject, discovered, session } = await setup();
      let billing = await addProject({ ref: 'billing', name: 'Billing' });
      let web = await addProject({ ref: 'web', name: 'Web' });
      let workspace = await discovered('workspace', 'root-hash-3', 'shared');

      let confirm = async (entityId: string) =>
        sessionClassificationService.reviewSession({
          organization,
          session: await session({ context: context({ workspaceIds: [workspace.id] }) }),
          input: { kind: 'project', action: 'accept', entityId }
        });

      await confirm(web.id);
      for (let index = 0; index < learnedLinkConfirmations; index++) await confirm(billing.id);

      expect(
        await testDb.entityLink.count({ where: { fromOid: workspace.oid, type: 'part_of' } })
      ).toBe(0);
    });
  });
});
