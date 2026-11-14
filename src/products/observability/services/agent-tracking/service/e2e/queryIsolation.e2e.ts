import { eventually, uniqueId } from '@lowerdeck/testing-tools';
import { beforeAll, describe, expect, it } from 'vitest';
import { sendClaudeApiRequest } from './knowledgeSupport';
import {
  agentTracking,
  createInstance,
  createProject,
  createScope,
  createToken,
  isoRange,
  rpcErrorCode,
  runQuery
} from './support';

let settleTimeoutMs = 120_000;

let model = 'claude-sonnet-4-5-20250929';

let fixedRange = isoRange(
  new Date(Date.now() - 24 * 60 * 60 * 1000),
  new Date(Date.now() + 60 * 60 * 1000)
);

let range = () => fixedRange;

let sendSessions = async (secret: string, count: number) => {
  for (let index = 0; index < count; index++) {
    await sendClaudeApiRequest({
      secret,
      sessionId: uniqueId('session'),
      model,
      inputTokens: 1000,
      outputTokens: 100
    });
  }
};

let countOf = async (
  organizationId: string,
  dataset: 'usage' | 'sessions',
  scope?: { projectIds?: string[]; instanceIds?: string[] }
) => {
  let result = await runQuery(
    organizationId,
    { dataset, range: range(), measures: [dataset == 'usage' ? 'requests' : 'sessions'] },
    scope
  );
  return Number(result.rows[0]?.[dataset == 'usage' ? 'requests' : 'sessions'] ?? 0);
};

let seed = async () => {
  let first = await createScope();
  let secondProject = await createProject(first.organization);
  let secondInstance = await createInstance(first.organization, secondProject);
  let other = await createScope();

  let firstToken = await createToken({}, first);
  let secondToken = await createToken(
    {},
    { organization: first.organization, project: secondProject, instance: secondInstance }
  );
  let otherToken = await createToken({}, other);

  await sendSessions(firstToken.secret, 2);
  await sendSessions(secondToken.secret, 1);
  await sendSessions(otherToken.secret, 1);

  await eventually(
    async () => {
      expect(await countOf(first.organization.id, 'sessions')).toBe(3);
      expect(await countOf(first.organization.id, 'usage')).toBe(3);
      expect(await countOf(other.organization.id, 'sessions')).toBe(1);
    },
    { timeoutMs: settleTimeoutMs }
  );

  return { first, secondProject, secondInstance, other };
};

describe('query isolation', () => {
  let seeded: Awaited<ReturnType<typeof seed>>;

  beforeAll(async () => {
    seeded = await seed();
  }, settleTimeoutMs + 30_000);

  it('only counts the organization’s own data', async () => {
    expect(await countOf(seeded.first.organization.id, 'usage')).toBe(3);
    expect(await countOf(seeded.other.organization.id, 'usage')).toBe(1);
    expect(await countOf(seeded.other.organization.id, 'sessions')).toBe(1);
  });

  it('narrows to the projects and instances in the scope', async () => {
    let organizationId = seeded.first.organization.id;

    expect(
      await countOf(organizationId, 'sessions', { projectIds: [seeded.first.project.id] })
    ).toBe(2);
    expect(
      await countOf(organizationId, 'usage', { instanceIds: [seeded.secondInstance.id] })
    ).toBe(1);
    expect(
      await countOf(organizationId, 'usage', {
        projectIds: [seeded.first.project.id],
        instanceIds: [seeded.secondInstance.id]
      })
    ).toBe(0);
  });

  it('rejects scopes that name another organization’s projects or instances', async () => {
    let organizationId = seeded.first.organization.id;

    expect(
      await rpcErrorCode(
        runQuery(
          organizationId,
          { dataset: 'usage', range: range(), measures: ['requests'] },
          { projectIds: [seeded.other.project.id] }
        )
      )
    ).toBe('not_found');
    expect(
      await rpcErrorCode(
        runQuery(
          organizationId,
          { dataset: 'sessions', mode: 'rows', range: range() },
          { instanceIds: [seeded.other.instance.id] }
        )
      )
    ).toBe('not_found');
  });

  it('returns only the organization’s rows and pages through them', async () => {
    let organizationId = seeded.first.organization.id;
    let instances = new Set([seeded.first.instance.id, seeded.secondInstance.id]);
    let seen: string[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < 10; page++) {
      let result = await runQuery(organizationId, {
        dataset: 'sessions',
        mode: 'rows',
        range: range(),
        select: ['session', 'metorial.instance'],
        limit: 1,
        ...(cursor ? { cursor } : {})
      });

      for (let row of result.rows) {
        expect(instances.has(String(row['metorial.instance']))).toBe(true);
        seen.push(String(row.session));
      }

      cursor = result.meta.nextCursor ?? undefined;
      if (!cursor) break;
    }

    expect(seen.length).toBe(3);
    expect(new Set(seen).size).toBe(3);
  });

  it('keeps grouped values inside the organization', async () => {
    let result = await runQuery(seeded.first.organization.id, {
      dataset: 'usage',
      range: range(),
      dimensions: ['metorial.project'],
      measures: ['requests']
    });

    expect(
      Object.fromEntries(result.rows.map(row => [row['metorial.project'], row.requests]))
    ).toEqual({ [seeded.first.project.id]: 2, [seeded.secondProject.id]: 1 });
  });

  it('does not accept cursors across organizations', async () => {
    let first = await runQuery(seeded.first.organization.id, {
      dataset: 'sessions',
      mode: 'rows',
      range: range(),
      limit: 1
    });
    let cursor = first.meta.nextCursor;
    expect(cursor).toBeTruthy();

    expect(
      await rpcErrorCode(
        runQuery(seeded.other.organization.id, {
          dataset: 'sessions',
          mode: 'rows',
          range: range(),
          limit: 1,
          cursor
        })
      )
    ).toBe('invalid_query');
  });

  it('lists field values of the organization only', async () => {
    let values = await agentTracking().query.values({
      organizationId: seeded.other.organization.id,
      dataset: 'usage',
      field: 'metorial.project',
      range: range()
    });

    let ids = JSON.stringify(values);
    expect(ids).toContain(seeded.other.project.id);
    expect(ids).not.toContain(seeded.first.project.id);
  });
});

describe('query privacy', () => {
  it(
    'hides individuals when the organization turns it on, and shows them again after',
    async () => {
      let scope = await createScope();
      let token = await createToken({}, scope);
      await sendSessions(token.secret, 1);

      await eventually(
        async () => {
          expect(await countOf(scope.organization.id, 'sessions')).toBe(1);
          expect(await countOf(scope.organization.id, 'usage')).toBe(1);
        },
        { timeoutMs: settleTimeoutMs }
      );

      let setHidden = (hideIndividuals: boolean) =>
        agentTracking().organization.upsert({
          ref: scope.organization.ref,
          settings: { privacy: { hideIndividuals } }
        });

      let rows = () =>
        runQuery(scope.organization.id, { dataset: 'sessions', mode: 'rows', range: range() });
      let byUser = () =>
        runQuery(scope.organization.id, {
          dataset: 'usage',
          range: range(),
          dimensions: ['user'],
          measures: ['requests']
        });

      expect((await rows()).rows.length).toBe(1);
      expect((await byUser()).rows.length).toBe(1);

      await setHidden(true);

      expect(await rpcErrorCode(rows())).toBe('invalid_query');
      expect(await rpcErrorCode(byUser())).toBe('invalid_query');
      expect(await countOf(scope.organization.id, 'usage')).toBe(1);

      await setHidden(false);

      expect((await rows()).rows.length).toBe(1);
    },
    settleTimeoutMs + 30_000
  );
});
