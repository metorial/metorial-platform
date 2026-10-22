import {
  expectError,
  expectOk,
  expectPresented,
  listAll,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  expectResponses,
  expectRoutesAuth,
  invalid,
  listAuth,
  managementApi,
  notFound
} from './_shared';

let monitorAuth = { ...listAuth, instance: 403 };

describe('api-core integrations: monitor', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('authenticates every monitor route per credential', async () => {
    await expectRoutesAuth(org, otherOrg, [
      { path: '/monitors', expected: monitorAuth },
      { path: '/monitor-alerts', expected: monitorAuth },
      { path: '/protoguard-alerts', expected: monitorAuth },
      { path: '/protoguard-config', expected: monitorAuth },
      { path: '/provider-specification-change-notifications', expected: listAuth }
    ]);
  });

  it('rejects invalid monitor bodies and queries', async () => {
    let management = managementApi(org);
    let config = expectOk(await management.get('/protoguard-config'));
    let filterId = config.filters[0]?.id ?? uniqueId('pgf');

    await expectResponses([
      invalid('monitor list with unknown status', () =>
        management.get('/monitors', { query: { status: 'paused' } })
      ),
      invalid('monitor list with unknown target', () =>
        management.get('/monitors', { query: { target: 'everything' } })
      ),
      invalid('alert list with unknown status', () =>
        management.get('/monitor-alerts', { query: { status: 'open' } })
      ),
      invalid('alert list with unknown source', () =>
        management.get('/monitor-alerts', { query: { source: 'manual' } })
      ),
      invalid('notification list with unknown target', () =>
        management.get('/provider-specification-change-notifications', {
          query: { target: 'tool' }
        })
      ),
      invalid('filter config with string enabled', () =>
        management.post(`/protoguard-config/filters/${filterId}`, { enabled: 'yes' })
      ),
      invalid('filter config with string threshold', () =>
        management.post(`/protoguard-config/filters/${filterId}`, {
          alert_confidence_threshold: 'high'
        })
      ),
      invalid('count threshold without threshold', () =>
        management.post('/protoguard-config/alert-filter-count-threshold', {})
      ),
      invalid('count threshold with string threshold', () =>
        management.post('/protoguard-config/alert-filter-count-threshold', {
          threshold: 'three'
        })
      )
    ]);
  });

  it('configures protoguard filters and the alert threshold per tenant', async () => {
    let management = managementApi(org);
    let initial = expectOk(await management.get('/protoguard-config'));
    expectPresented(initial, 'protoguard.filter_config');
    expect(initial.filters.length).toBeGreaterThan(0);
    for (let filter of initial.filters) expectPresented(filter, 'protoguard.filter');

    let [filter] = initial.filters;
    expect(filter).toMatchObject({
      enabled: filter.default_enabled,
      alert_confidence_threshold: filter.default_alert_confidence_threshold
    });

    let toggled = expectOk(
      await management.post(`/protoguard-config/filters/${filter.id}`, {
        enabled: !filter.default_enabled,
        alert_confidence_threshold: 0.42
      })
    );
    expectPresented(toggled, 'protoguard.filter_config');
    expect(toggled.filters.find((item: any) => item.id === filter.id)).toMatchObject({
      enabled: !filter.default_enabled,
      alert_confidence_threshold: 0.42
    });

    let byKey = expectOk(
      await org.clients.rest.post(
        `/dashboard/instances/${org.ids.instanceId}/protoguard-config/filters/${filter.key}`,
        { enabled: filter.default_enabled }
      )
    );
    expect(byKey.filters.find((item: any) => item.id === filter.id)).toMatchObject({
      enabled: filter.default_enabled,
      alert_confidence_threshold: 0.42
    });

    let reset = expectOk(
      await management.post(`/protoguard-config/filters/${filter.id}`, {
        alert_confidence_threshold: null
      })
    );
    expect(
      reset.filters.find((item: any) => item.id === filter.id).alert_confidence_threshold
    ).toBe(filter.default_alert_confidence_threshold);

    let threshold = initial.alert_filter_count_threshold + 2;
    let raised = expectOk(
      await management.post('/protoguard-config/alert-filter-count-threshold', { threshold })
    );
    expect(raised.alert_filter_count_threshold).toBe(threshold);
    expect(
      expectOk(await management.get('/protoguard-config')).alert_filter_count_threshold
    ).toBe(threshold);

    let other = expectOk(await managementApi(otherOrg).get('/protoguard-config'));
    expect(other.alert_filter_count_threshold).toBe(initial.alert_filter_count_threshold);
    expect(other.filters.find((item: any) => item.id === filter.id)).toMatchObject({
      enabled: filter.default_enabled,
      alert_confidence_threshold: filter.default_alert_confidence_threshold
    });

    let cleared = expectOk(
      await management.post('/protoguard-config/alert-filter-count-threshold', {
        threshold: null
      })
    );
    expect(cleared.alert_filter_count_threshold).toBe(initial.alert_filter_count_threshold);

    await expectResponses([
      {
        label: 'filter update without fields',
        call: () => management.post(`/protoguard-config/filters/${filter.id}`, {}),
        status: 400,
        code: 'bad_request'
      },
      {
        label: 'filter update with an instance key',
        call: () =>
          org.clients.instance.post(`/protoguard-config/filters/${filter.id}`, {
            enabled: true
          }),
        status: 403
      },
      {
        label: 'threshold update from another organization',
        call: () =>
          otherOrg.clients.management.post(
            `/instances/${org.ids.instanceId}/protoguard-config/alert-filter-count-threshold`,
            { threshold: 9 }
          ),
        status: 404
      }
    ]);
  });

  it('rejects an unknown protoguard filter with 404', async () => {
    expectError(
      await managementApi(org).post(`/protoguard-config/filters/${uniqueId('pgf')}`, {
        enabled: true
      }),
      404
    );
  });

  it('lists no monitors, alerts or notifications for a new organization', async () => {
    let management = managementApi(org);

    for (let path of ['/monitors', '/monitor-alerts', '/protoguard-alerts']) {
      expect(await listAll(management, path)).toEqual([]);
    }
    let notifications = await listAll(
      org.clients.instance,
      '/provider-specification-change-notifications'
    );
    expect(
      await subspaceDb.providerSpecificationChangeNotification.count({
        where: { id: { in: notifications.map(notification => notification.id) }, tenantOid: { not: null } }
      })
    ).toBe(0);

    await expectResponses([
      notFound('unknown monitor', () => management.get(`/monitors/${uniqueId('mon')}`)),
      notFound('unknown alert', () => management.get(`/monitor-alerts/${uniqueId('mal')}`)),
      notFound('resolve unknown alert', () =>
        management.post(`/monitor-alerts/${uniqueId('mal')}/resolve`)
      ),
      notFound('unresolve unknown alert', () =>
        management.post(`/monitor-alerts/${uniqueId('mal')}/unresolve`)
      ),
      notFound('view unknown alert', () =>
        management.post(`/monitor-alerts/${uniqueId('mal')}/viewed`)
      ),
      notFound('unknown protoguard alert', () =>
        management.get(`/protoguard-alerts/${uniqueId('pga')}`)
      ),
      notFound('unknown notification', () =>
        org.clients.instance.get(
          `/provider-specification-change-notifications/${uniqueId('psn')}`
        )
      )
    ]);
  });
});
