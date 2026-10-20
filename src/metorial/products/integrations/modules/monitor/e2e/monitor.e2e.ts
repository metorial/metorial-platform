import { firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { resolveMetorialFacing } from '@metorial-subspace/module-tenant';
import { describe, expect, it } from 'vitest';
import {
  alertService,
  DEFAULT_PROTO_GUARD_ALERT_FILTER_COUNT_THRESHOLD,
  monitorService,
  protoGuardAlertService,
  protoGuardConfigService
} from '../src';

describe('module-monitor', () => {
  let org = useOrganization();

  it('lists only system or own monitors and no alerts for a fresh instance', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { tenant } = await resolveMetorialFacing({ instance: fixture.instance });

    let monitors = await firstPage(
      await monitorService.listMonitors({ instance: fixture.instance })
    );
    for (let monitor of monitors) {
      expect(monitor.owner === 'system' || monitor.tenantOid === tenant.oid).toBe(true);
    }

    let alerts = await firstPage(
      await alertService.listAlerts({ instance: fixture.instance })
    );
    expect(alerts).toEqual([]);

    let protoGuardAlerts = await firstPage(
      await protoGuardAlertService.listAlerts({ instance: fixture.instance })
    );
    expect(protoGuardAlerts).toEqual([]);

    await expect(
      monitorService.getMonitorById({ instance: fixture.instance, monitorId: uniqueId('mon') })
    ).rejects.toThrow();
    await expect(
      alertService.getAlertById({ instance: fixture.instance, alertId: uniqueId('alert') })
    ).rejects.toThrow();
  });

  it('sets and resets the tenant alert filter count threshold', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let initial = await protoGuardConfigService.listFilters({ instance: fixture.instance });
    expect(initial.alertFilterCountThreshold).toBe(
      DEFAULT_PROTO_GUARD_ALERT_FILTER_COUNT_THRESHOLD
    );

    let setting = await protoGuardConfigService.setTenantAlertFilterCountThreshold({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      threshold: 5
    });
    expect(setting?.alertFilterCountThreshold).toBe(5);
    expect(
      (await protoGuardConfigService.listFilters({ instance: fixture.instance }))
        .alertFilterCountThreshold
    ).toBe(5);

    let reset = await protoGuardConfigService.setTenantAlertFilterCountThreshold({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      threshold: null
    });
    expect(reset).toBeNull();
    expect(
      (await protoGuardConfigService.listFilters({ instance: fixture.instance }))
        .alertFilterCountThreshold
    ).toBe(DEFAULT_PROTO_GUARD_ALERT_FILTER_COUNT_THRESHOLD);
  });
});
