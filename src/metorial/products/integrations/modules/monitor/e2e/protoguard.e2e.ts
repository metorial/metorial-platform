import {
  createRemoteProvider,
  defaultMcpTestTools,
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useFixture,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { alertService, monitorService, protoGuardAlertService } from '../src';
import {
  callTool,
  openSession,
  readNotesTool,
  scopeOf,
  waitForProtoGuardRun
} from './_fixtures';

let ids = (items: { id: string }[]) => items.map(item => item.id);

describe('module-monitor protoguard alerts', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer({ tools: [...defaultMcpTestTools, readNotesTool] });
  let remote = useFixture(() =>
    createRemoteProvider(org.clients.instance, { url: server.url })
  );

  let sessionOnce: ReturnType<typeof openSession> | undefined;
  let ensureSession = () => (sessionOnce ??= openSession(org, remote.providerId));

  let raiseProtoGuardAlert = async () => {
    let opened = await ensureSession();
    let { message } = await callTool(opened, 'read_notes');
    let run = await waitForProtoGuardRun(message.oid);
    expect(run.alert).not.toBeNull();

    let scope = await scopeOf(org);
    let filterKeys = [...new Set(run.alert!.instances.map(instance => instance.filter.key))];
    let monitorAlerts = await eventually(
      async () => {
        let alerts = await firstPage(
          await alertService.listAlerts({
            instance: scope.instance,
            protoGuardAlertIds: [run.alert!.id]
          })
        );
        expect(alerts).toHaveLength(filterKeys.length);
        return alerts;
      },
      { timeoutMs: 60_000, intervalMs: 500 }
    );

    return {
      session: opened.session,
      message,
      run,
      alert: run.alert!,
      filterKeys,
      monitorAlerts
    };
  };

  let firstOnce: ReturnType<typeof raiseProtoGuardAlert> | undefined;
  let ensureFirstAlert = () => (firstOnce ??= raiseProtoGuardAlert());

  let secondOnce: ReturnType<typeof raiseProtoGuardAlert> | undefined;
  let ensureSecondAlert = async () => {
    await ensureFirstAlert();
    return await (secondOnce ??= raiseProtoGuardAlert());
  };

  it('opens one pending alert per triggered filter on that filter’s monitor', async () => {
    let { alert, filterKeys, monitorAlerts, session } = await ensureFirstAlert();
    let scope = await scopeOf(org);

    expect(filterKeys).toEqual(
      expect.arrayContaining(['instruction_override', 'prompt_exfiltration'])
    );
    expect(
      monitorAlerts.map(monitorAlert => monitorAlert.monitor.protoGuardFilter?.key).sort()
    ).toEqual([...filterKeys].sort());

    for (let monitorAlert of monitorAlerts) {
      let filter = monitorAlert.monitor.protoGuardFilter!;

      expect(monitorAlert).toMatchObject({
        status: 'pending',
        resolvedAt: null,
        createdAt: alert.createdAt,
        tenantOid: scope.tenant.oid,
        environmentOid: scope.environment.oid
      });
      expect(monitorAlert.monitorAlertEvents.map(event => event.type)).toEqual(['created']);
      expect(monitorAlert.protoGuardAlert?.id).toBe(alert.id);
      expect(monitorAlert.monitor).toMatchObject({
        key: [
          'tenant',
          scope.tenant.id,
          scope.environment.id,
          scope.solution.id,
          'protoguard_filter',
          filter.key
        ].join(':'),
        name: `Protoguard: ${filter.name}`,
        target: 'protoguard_filter',
        status: 'active',
        owner: 'tenant'
      });
      expect(monitorAlert.monitor.lastAlertAt!.getTime()).toBeGreaterThanOrEqual(
        alert.createdAt.getTime()
      );
    }

    let protoGuardAlert = await protoGuardAlertService.getAlertById({
      instance: scope.instance,
      alertId: alert.id
    });
    expect(protoGuardAlert.id).toBe(alert.id);
    expect(
      ids(
        await firstPage(
          await protoGuardAlertService.listAlerts({
            instance: scope.instance,
            sessionIds: [session.id]
          })
        )
      )
    ).toContain(alert.id);
  }, 300_000);

  it('reuses the filter monitors for a later alert and advances their alert window', async () => {
    let first = await ensureFirstAlert();
    let second = await ensureSecondAlert();
    let scope = await scopeOf(org);

    expect(second.alert.id).not.toBe(first.alert.id);
    expect(second.monitorAlerts.map(alert => alert.monitorOid).sort()).toEqual(
      first.monitorAlerts.map(alert => alert.monitorOid).sort()
    );

    for (let key of first.filterKeys) {
      let filter = await subspaceDb.protoGuardFilter.findUniqueOrThrow({ where: { key } });
      let monitors = await firstPage(
        await monitorService.listMonitors({
          instance: scope.instance,
          targets: ['protoguard_filter'],
          protoGuardFilterIds: [filter.id]
        })
      );
      expect(monitors).toHaveLength(1);
      expect(monitors[0]!.lastAlertAt!.getTime()).toBeGreaterThanOrEqual(
        second.alert.createdAt.getTime()
      );
      expect(monitors[0]!.firstAlertAt!.getTime()).toBeLessThanOrEqual(
        first.alert.createdAt.getTime()
      );
    }
  }, 300_000);

  it('filters monitor and protoguard alerts by run, filter, session and source', async () => {
    let first = await ensureFirstAlert();
    let second = await ensureSecondAlert();
    let scope = await scopeOf(org);
    let all = [...first.monitorAlerts, ...second.monitorAlerts].map(alert => alert.id).sort();

    let listAlerts = async (
      input: Omit<Parameters<typeof alertService.listAlerts>[0], 'instance'>
    ) =>
      ids(
        await firstPage(await alertService.listAlerts({ instance: scope.instance, ...input }))
      );

    expect((await listAlerts({ sessionIds: [first.session.id] })).sort()).toEqual(all);
    expect((await listAlerts({ protoGuardRunIds: [first.run.id] })).sort()).toEqual(
      ids(first.monitorAlerts).sort()
    );
    expect((await listAlerts({ sessionMessageIds: [second.message.id] })).sort()).toEqual(
      ids(second.monitorAlerts).sort()
    );

    let exfiltration = await subspaceDb.protoGuardFilter.findUniqueOrThrow({
      where: { key: 'prompt_exfiltration' }
    });
    let roleHijack = await subspaceDb.protoGuardFilter.findUniqueOrThrow({
      where: { key: 'role_hijack' }
    });
    expect(
      (
        await listAlerts({
          sessionIds: [first.session.id],
          protoGuardFilterIds: [exfiltration.id]
        })
      ).sort()
    ).toEqual(all);
    expect(
      await listAlerts({
        sessionIds: [first.session.id],
        protoGuardFilterIds: [roleHijack.id]
      })
    ).toEqual([]);

    let exfiltrationMonitor = first.monitorAlerts.find(
      alert => alert.monitor.protoGuardFilter?.key === 'prompt_exfiltration'
    )!.monitor;
    expect(
      (
        await listAlerts({
          sessionIds: [first.session.id],
          monitorIds: [exfiltrationMonitor.id]
        })
      ).sort()
    ).toEqual(
      [...first.monitorAlerts, ...second.monitorAlerts]
        .filter(alert => alert.monitorOid === exfiltrationMonitor.oid)
        .map(alert => alert.id)
        .sort()
    );

    expect(
      (await listAlerts({ sessionIds: [first.session.id], sources: ['protoguard'] })).sort()
    ).toEqual(all);
    expect(
      await listAlerts({ sessionIds: [first.session.id], sources: ['specification_change'] })
    ).toEqual([]);
    expect(
      await listAlerts({ sessionIds: [first.session.id], targets: ['schema_change'] })
    ).toEqual([]);
    expect(await listAlerts({ sessionIds: [uniqueId('missing-session')] })).toEqual([]);

    let listProtoGuardAlerts = async (
      input: Omit<Parameters<typeof protoGuardAlertService.listAlerts>[0], 'instance'>
    ) =>
      ids(
        await firstPage(
          await protoGuardAlertService.listAlerts({ instance: scope.instance, ...input })
        )
      );

    expect(await listProtoGuardAlerts({ runIds: [second.run.id] })).toEqual([second.alert.id]);
    expect(
      (
        await listProtoGuardAlerts({
          sessionIds: [first.session.id],
          filterIds: [exfiltration.id]
        })
      ).sort()
    ).toEqual([first.alert.id, second.alert.id].sort());
    expect(await listProtoGuardAlerts({ sessionMessageIds: [first.message.id] })).toEqual([
      first.alert.id
    ]);
  }, 300_000);

  it('raises no monitor alert for a benign tool call', async () => {
    let opened = await ensureSession();
    let scope = await scopeOf(org);
    let { message } = await callTool(opened, 'add', { a: 2, b: 3 });

    let run = await waitForProtoGuardRun(message.oid);
    expect(run).toMatchObject({ status: 'completed', triggeredFilterCount: 0, alert: null });
    expect(
      await firstPage(
        await alertService.listAlerts({
          instance: scope.instance,
          sessionMessageIds: [message.id]
        })
      )
    ).toEqual([]);
  }, 300_000);

  it('hides protoguard monitors and alerts from other organizations', async () => {
    let { alert, monitorAlerts } = await ensureFirstAlert();
    let other = await scopeOf(otherOrg);
    let monitorAlert = monitorAlerts[0]!;

    await expectServiceError(
      alertService.getAlertById({ instance: other.instance, alertId: monitorAlert.id }),
      'not_found'
    );
    await expectServiceError(
      alertService.markViewed({ instance: other.instance, alertId: monitorAlert.id }),
      'not_found'
    );
    await expectServiceError(
      protoGuardAlertService.getAlertById({ instance: other.instance, alertId: alert.id }),
      'not_found'
    );
    await expectServiceError(
      monitorService.getMonitorById({
        instance: other.instance,
        monitorId: monitorAlert.monitor.id
      }),
      'not_found'
    );

    expect(
      await firstPage(
        await alertService.listAlerts({
          instance: other.instance,
          protoGuardAlertIds: [alert.id]
        })
      )
    ).toEqual([]);
    expect(
      await firstPage(
        await protoGuardAlertService.listAlerts({ instance: other.instance, ids: [alert.id] })
      )
    ).toEqual([]);
    expect(
      await firstPage(
        await monitorService.listMonitors({
          instance: other.instance,
          ids: [monitorAlert.monitor.id]
        })
      )
    ).toEqual([]);
  }, 300_000);
});
