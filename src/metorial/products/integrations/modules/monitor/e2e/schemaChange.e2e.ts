import {
  createRemoteProvider,
  defaultMcpTestTools,
  eventually,
  expectServiceError,
  firstPage,
  type McpTestTool,
  uniqueId,
  useFixture,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import { alertService, type ListAlertsParams, monitorService } from '../src';
import {
  createDeployment,
  openSession,
  scopeOf,
  setTools,
  textTool,
  toolKeys,
  waitForVersionNotification,
  waitForVersionTools
} from './_fixtures';

let ids = (items: { id: string }[]) => items.map(item => item.id);

describe('module-monitor schema change monitors', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let tools: McpTestTool[] = [...defaultMcpTestTools];
  let server = useMcpTestServer({ tools });
  let remote = useFixture(async () => {
    let remote = await createRemoteProvider(org.clients.instance, { url: server.url });
    await openSession(org, remote.providerId);
    await waitForVersionTools(remote.providerId, ['tool_add', 'tool_echo']);
    return remote;
  });

  let changeTools = async (names: string[]) => {
    setTools(tools, [...defaultMcpTestTools, ...names.map(textTool)]);
    await openSession(org, remote.providerId);

    let version = await waitForVersionTools(
      remote.providerId,
      names.map(name => `tool_${name}`)
    );
    let notification = await waitForVersionNotification({
      versionOid: version.oid,
      toSpecificationOid: version.specificationOid!
    });

    return { version, notification };
  };

  let listProviderMonitors = async () => {
    let scope = await scopeOf(org);
    return await firstPage(
      await monitorService.listMonitors({
        instance: scope.instance,
        targets: ['schema_change'],
        providerIds: [remote.providerId]
      })
    );
  };

  let listMonitorAlerts = async (
    monitorId: string,
    input: Omit<ListAlertsParams, 'tenant' | 'environment'> = {}
  ) => {
    let scope = await scopeOf(org);
    return await firstPage(
      await alertService.listAlerts({
        instance: scope.instance,
        monitorIds: [monitorId],
        ...input
      })
    );
  };

  let waitForAlert = (monitorId: string, notificationId: string) =>
    eventually(
      async () => {
        let [alert] = await listMonitorAlerts(monitorId, {
          specificationChangeNotificationIds: [notificationId]
        });
        if (!alert) throw new Error(`No alert for notification ${notificationId} yet`);
        return alert;
      },
      { timeoutMs: 60_000, intervalMs: 500 }
    );

  let monitorOnce: ReturnType<typeof listProviderMonitors> | undefined;
  let ensureMonitor = async () => {
    monitorOnce ??= (async () => {
      await createDeployment(org, remote.providerId);

      return await eventually(
        async () => {
          let monitors = await listProviderMonitors();
          expect(monitors).toHaveLength(1);
          return monitors;
        },
        { timeoutMs: 60_000, intervalMs: 500 }
      );
    })();

    return (await monitorOnce)[0]!;
  };

  let pendingOnce: ReturnType<typeof createPendingAlert> | undefined;
  let createPendingAlert = async () => {
    let monitor = await ensureMonitor();
    let change = await changeTools(['multiply', 'divide']);
    let alert = await waitForAlert(monitor.id, change.notification.id);

    return { monitor, alert, ...change };
  };
  let ensurePendingAlert = () => (pendingOnce ??= createPendingAlert());

  it('opens a monitor only for a durable deployment and backfills earlier changes as ignored', async () => {
    let scope = await scopeOf(org);
    let earlier = await changeTools(['multiply']);

    expect(await listProviderMonitors()).toEqual([]);

    let monitor = await ensureMonitor();
    expect(monitor).toMatchObject({
      key: [
        'tenant',
        scope.tenant.id,
        scope.environment.id,
        scope.solution.id,
        'schema_change',
        remote.providerId
      ].join(':'),
      target: 'schema_change',
      status: 'active',
      owner: 'tenant',
      tenantOid: scope.tenant.oid,
      environmentOid: scope.environment.oid,
      provider: expect.objectContaining({ id: remote.providerId })
    });
    expect(monitor.name).toBe(`Provider schema changes: ${monitor.provider!.name}`);

    let backfilled = await waitForAlert(monitor.id, earlier.notification.id);
    expect(backfilled).toMatchObject({
      status: 'ignored',
      resolvedAt: null,
      createdAt: earlier.notification.createdAt
    });
    expect(backfilled.monitorAlertEvents.map(event => event.type)).toEqual(['created']);
    expect(backfilled.specificationChangeNotification).toMatchObject({
      id: earlier.notification.id,
      target: 'version'
    });

    await createDeployment(org, remote.providerId);
    await new Promise(resolve => setTimeout(resolve, 3_000));
    expect(ids(await listProviderMonitors())).toEqual([monitor.id]);
  }, 300_000);

  it('raises a pending alert for a schema change once the monitor exists', async () => {
    let { monitor, alert, version, notification } = await ensurePendingAlert();

    expect(alert).toMatchObject({
      status: 'pending',
      resolvedAt: null,
      createdAt: notification.createdAt,
      monitor: expect.objectContaining({ id: monitor.id })
    });
    expect(alert.monitorAlertEvents.map(event => event.type)).toEqual(['created']);

    let change = alert.specificationChangeNotification!.versionSpecificationChange!;
    expect(change.toSpecification.oid).toBe(version.specificationOid);
    expect(toolKeys(change.toSpecification as any)).toContain('tool_divide');
    expect(toolKeys(change.fromSpecification as any)).not.toContain('tool_divide');

    let refreshed = await monitorService.getMonitorById({
      instance: (await scopeOf(org)).instance,
      monitorId: monitor.id
    });
    expect(refreshed.lastAlertAt).toEqual(notification.createdAt);
    expect(refreshed.firstAlertAt!.getTime()).toBeLessThanOrEqual(
      notification.createdAt.getTime()
    );
  }, 300_000);

  it('filters schema change alerts and monitors', async () => {
    let { monitor, alert } = await ensurePendingAlert();
    let scope = await scopeOf(org);

    expect(ids(await listMonitorAlerts(monitor.id, { statuses: ['pending'] }))).toContain(
      alert.id
    );
    expect(ids(await listMonitorAlerts(monitor.id, { statuses: ['ignored'] }))).not.toContain(
      alert.id
    );
    expect(
      ids(await listMonitorAlerts(monitor.id, { sources: ['specification_change'] }))
    ).toContain(alert.id);
    expect(await listMonitorAlerts(monitor.id, { sources: ['protoguard'] })).toEqual([]);
    expect(await listMonitorAlerts(monitor.id, { targets: ['protoguard_filter'] })).toEqual(
      []
    );
    expect(await listMonitorAlerts(monitor.id, { owners: ['system'] })).toEqual([]);
    expect(
      ids(await listMonitorAlerts(monitor.id, { providerIds: [remote.providerId] }))
    ).toContain(alert.id);
    expect(
      await listMonitorAlerts(monitor.id, { providerIds: [uniqueId('missing-provider')] })
    ).toEqual([]);
    expect(
      ids(await listMonitorAlerts(monitor.id, { createdAt: { gte: alert.createdAt } }))
    ).toContain(alert.id);
    expect(
      ids(await listMonitorAlerts(monitor.id, { createdAt: { gt: alert.createdAt } }))
    ).not.toContain(alert.id);

    let listMonitors = async (input: Parameters<typeof monitorService.listMonitors>[0]) =>
      ids(await firstPage(await monitorService.listMonitors(input)));

    expect(await listMonitors({ instance: scope.instance, ids: [monitor.id] })).toEqual([
      monitor.id
    ]);
    expect(
      await listMonitors({
        instance: scope.instance,
        search: monitor.provider!.name.toUpperCase(),
        targets: ['schema_change']
      })
    ).toEqual([monitor.id]);
    expect(
      await listMonitors({
        instance: scope.instance,
        ids: [monitor.id],
        statuses: ['archived']
      })
    ).toEqual([]);
    expect(
      await listMonitors({
        instance: scope.instance,
        providerIds: [remote.providerId],
        targets: ['protoguard_filter']
      })
    ).toEqual([]);
  }, 300_000);

  it('records views, resolution and reopening of an alert', async () => {
    let { alert } = await ensurePendingAlert();
    let scope = await scopeOf(org);
    let byActor = { instance: scope.instance, organizationActor: scope.organizationActor };

    let viewed = await alertService.getAlertById({ ...byActor, alertId: alert.id });
    expect(viewed.monitorAlertRecipients).toHaveLength(1);
    let recipient = viewed.monitorAlertRecipients[0]!;
    expect(recipient.viewedAt).not.toBeNull();
    expect(viewed.monitorAlertEvents.filter(event => event.type === 'viewed')).toEqual([
      expect.objectContaining({ actorOid: recipient.recipientOid })
    ]);

    let anonymous = await alertService.getAlertById({
      instance: scope.instance,
      alertId: alert.id
    });
    expect(anonymous.monitorAlertRecipients).toHaveLength(1);

    let marked = await alertService.markViewed({ ...byActor, alertId: alert.id });
    expect(marked.status).toBe('pending');
    expect(marked.monitorAlertRecipients).toHaveLength(1);
    expect(marked.monitorAlertEvents.filter(event => event.type === 'viewed')).toHaveLength(1);

    let resolved = await alertService.resolveAlert({ ...byActor, alertId: alert.id });
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolvedAt).toBeInstanceOf(Date);
    expect(resolved.monitorAlertEvents.find(event => event.type === 'resolved')).toMatchObject(
      {
        actorOid: recipient.recipientOid
      }
    );
    expect(
      ids(
        await firstPage(
          await alertService.listAlerts({
            instance: scope.instance,
            statuses: ['resolved'],
            resolvedAt: { gte: resolved.resolvedAt! }
          })
        )
      )
    ).toEqual([alert.id]);

    let reopened = await alertService.unresolveAlert({ ...byActor, alertId: alert.id });
    expect(reopened).toMatchObject({ status: 'pending', resolvedAt: null });
    expect(reopened.monitorAlertEvents.map(event => event.type).sort()).toEqual([
      'created',
      'resolved',
      'unresolved',
      'viewed'
    ]);
  }, 300_000);

  it('hides monitors and alerts from other organizations', async () => {
    let { monitor, alert } = await ensurePendingAlert();
    let other = await scopeOf(otherOrg);
    let before = await alertService.getAlertById({
      instance: (await scopeOf(org)).instance,
      alertId: alert.id
    });

    await expectServiceError(
      alertService.getAlertById({ instance: other.instance, alertId: alert.id }),
      'not_found'
    );
    await expectServiceError(
      alertService.resolveAlert({ instance: other.instance, alertId: alert.id }),
      'not_found'
    );
    await expectServiceError(
      monitorService.getMonitorById({ instance: other.instance, monitorId: monitor.id }),
      'not_found'
    );

    expect(
      await firstPage(
        await alertService.listAlerts({ instance: other.instance, ids: [alert.id] })
      )
    ).toEqual([]);
    expect(
      await firstPage(
        await alertService.listAlerts({
          instance: other.instance,
          providerIds: [remote.providerId]
        })
      )
    ).toEqual([]);
    expect(
      await firstPage(
        await monitorService.listMonitors({ instance: other.instance, ids: [monitor.id] })
      )
    ).toEqual([]);

    let after = await alertService.getAlertById({
      instance: (await scopeOf(org)).instance,
      alertId: alert.id
    });
    expect(after).toMatchObject({ status: before.status, resolvedAt: before.resolvedAt });
  }, 300_000);
});
