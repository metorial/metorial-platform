import { eventually, uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { createScope, agentTracking, rpcErrorCode } from './support';

let emptyRange = {
  from: new Date('2020-01-01T00:00:00Z'),
  to: new Date('2020-01-02T00:00:00Z')
};

describe('rebuild runs', () => {
  it('starts, completes and lists a run over an empty range', async () => {
    let { organization, project, instance } = await createScope();

    let run = await agentTracking().rebuild.start({
      organizationId: organization.id,
      scope: { instanceId: instance.id },
      range: emptyRange,
      layers: ['facts', 'attribution'],
      reason: 'support ticket'
    });

    expect(run).toMatchObject({
      object: 'agent_tracking#rebuild_run',
      layers: ['attribution', 'facts'],
      reason: 'support ticket',
      organizationId: organization.id,
      scope: { projectId: project.id, instanceId: instance.id },
      error: null
    });
    expect(new Date(run.range.from)).toEqual(emptyRange.from);
    expect(new Date(run.range.to)).toEqual(emptyRange.to);

    let completed = await eventually(async () => {
      let fetched = await agentTracking().rebuild.get({
        organizationId: organization.id,
        rebuildRunId: run.id
      });
      expect(fetched.status).toBe('completed');

      return fetched;
    });
    expect(completed.progress).toEqual({ processed: 0, total: 0 });
    expect(completed.completedAt).not.toBeNull();

    let listed = await agentTracking().rebuild.list({ organizationId: organization.id });
    expect(listed.items.map(item => item.id)).toEqual([run.id]);

    let running = await agentTracking().rebuild.list({
      organizationId: organization.id,
      statuses: ['running']
    });
    expect(running.items).toEqual([]);

    let cancelled = await agentTracking().rebuild.cancel({
      organizationId: organization.id,
      rebuildRunId: run.id
    });
    expect(cancelled.status).toBe('completed');
  });

  it('cancels a run', async () => {
    let { organization } = await createScope();

    let run = await agentTracking().rebuild.start({
      organizationId: organization.id,
      range: emptyRange,
      layers: ['summary']
    });
    expect(run.reason).toBe('manual');
    expect(run.scope).toEqual({ projectId: null, instanceId: null });

    let cancelled = await agentTracking().rebuild.cancel({
      organizationId: organization.id,
      rebuildRunId: run.id
    });

    // The worker may finish an empty run before the cancel lands.
    expect(['cancelled', 'completed']).toContain(cancelled.status);
    expect(cancelled.completedAt).not.toBeNull();
  });

  it('rejects invalid input', async () => {
    let { organization } = await createScope();
    let other = await createScope();

    let start = (input: Record<string, unknown>) =>
      rpcErrorCode(
        agentTracking().rebuild.start({
          organizationId: organization.id,
          range: emptyRange,
          layers: ['attribution'],
          ...input
        } as Parameters<ReturnType<typeof agentTracking>['rebuild']['start']>[0])
      );

    expect(await start({ layers: [] })).toBe('invalid_data');
    expect(await start({ layers: ['bogus'] })).toBe('invalid_data');
    expect(await start({ range: { from: emptyRange.to, to: emptyRange.from } })).toBe(
      'bad_request'
    );
    expect(await start({ scope: { instanceId: other.instance.id } })).toBe('not_found');
    expect(
      await start({ scope: { projectId: other.project.id, instanceId: other.instance.id } })
    ).toBe('not_found');

    let run = await agentTracking().rebuild.start({
      organizationId: other.organization.id,
      range: emptyRange,
      layers: ['attribution']
    });

    expect(
      await rpcErrorCode(
        agentTracking().rebuild.get({ organizationId: organization.id, rebuildRunId: run.id })
      )
    ).toBe('not_found');
    expect(
      await rpcErrorCode(
        agentTracking().rebuild.cancel({
          organizationId: organization.id,
          rebuildRunId: run.id
        })
      )
    ).toBe('not_found');
    expect(
      await rpcErrorCode(
        agentTracking().rebuild.start({
          organizationId: uniqueId('missing'),
          range: emptyRange,
          layers: ['attribution']
        })
      )
    ).toBe('not_found');
  });
});
