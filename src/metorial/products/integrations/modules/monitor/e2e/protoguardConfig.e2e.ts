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
import {
  alertService,
  DEFAULT_PROTO_GUARD_ALERT_FILTER_COUNT_THRESHOLD,
  getProtoGuardConfigForEvaluation,
  protoGuardConfigService
} from '../src';
import {
  callTool,
  openSession,
  readNotesTool,
  scopeOf,
  waitForProtoGuardRun
} from './_fixtures';

let filterKeys = [
  'encoded_payload',
  'format_break',
  'instruction_block',
  'instruction_override',
  'jailbreak_persona',
  'prompt_exfiltration',
  'role_hijack',
  'tool_call_forgery',
  'typoglycemia',
  'unicode_smuggling'
];

let loadFilter = (key: string) =>
  subspaceDb.protoGuardFilter.findUniqueOrThrow({ where: { key } });

let entryFor = (
  config: Awaited<ReturnType<typeof protoGuardConfigService.listFilters>>,
  key: string
) => config.filters.find(entry => entry.filter.key === key)!;

describe('module-monitor protoguard config', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let scope = useFixture(async () => {
    let scope = await scopeOf(org);
    await eventually(
      async () => {
        let config = await protoGuardConfigService.listFilters({ instance: scope.instance });
        expect(config.filters.map(entry => entry.filter.key)).toEqual(
          expect.arrayContaining(filterKeys)
        );
      },
      { timeoutMs: 60_000, intervalMs: 1_000 }
    );
    return scope;
  });

  let countSettings = async () =>
    (await subspaceDb.protoGuardTenantFilterSetting.count({
      where: { tenantOid: scope.tenant.oid }
    })) +
    (await subspaceDb.protoGuardTenantSetting.count({
      where: { tenantOid: scope.tenant.oid }
    }));

  it('lists every registered filter with its defaults for a fresh tenant', async () => {
    let config = await protoGuardConfigService.listFilters({ instance: scope.instance });

    expect(config.alertFilterCountThreshold).toBe(
      DEFAULT_PROTO_GUARD_ALERT_FILTER_COUNT_THRESHOLD
    );
    for (let entry of config.filters) {
      expect(entry.enabled).toBe(entry.filter.defaultEnabled);
      expect(entry.alertConfidenceThreshold).toBe(entry.filter.alertConfidenceThreshold);
    }

    let evaluation = await getProtoGuardConfigForEvaluation({ tenantOid: scope.tenant.oid });
    expect(evaluation.alertFilterCountThreshold).toBe(config.alertFilterCountThreshold);
    expect(evaluation.filters.map(filter => filter.key).sort()).toEqual(
      config.filters.map(entry => entry.filter.key).sort()
    );
  });

  it('disables a filter by key, re-enables it by id and serves it to evaluation at once', async () => {
    let filter = await loadFilter('jailbreak_persona');

    let disabled = await protoGuardConfigService.setTenantFilterEnabled({
      instance: scope.instance,
      auditScope: scope.auditScope,
      filterId: filter.key,
      enabled: false
    });
    expect(disabled).toMatchObject({
      enabled: false,
      alertConfidenceThreshold: null,
      filterOid: filter.oid,
      tenantOid: scope.tenant.oid
    });

    let config = await protoGuardConfigService.listFilters({ instance: scope.instance });
    expect(entryFor(config, filter.key)).toMatchObject({
      enabled: false,
      alertConfidenceThreshold: filter.alertConfidenceThreshold
    });
    expect(entryFor(config, 'role_hijack').enabled).toBe(true);

    let evaluation = await getProtoGuardConfigForEvaluation({ tenantOid: scope.tenant.oid });
    expect(evaluation.filters.find(entry => entry.key === filter.key)?.enabled).toBe(false);

    let enabled = await protoGuardConfigService.setTenantFilterEnabled({
      instance: scope.instance,
      auditScope: scope.auditScope,
      filterId: filter.id,
      enabled: true
    });
    expect(enabled).toMatchObject({ id: disabled.id, enabled: true });
    expect(
      await subspaceDb.protoGuardTenantFilterSetting.count({
        where: { tenantOid: scope.tenant.oid, filterOid: filter.oid }
      })
    ).toBe(1);
    expect(
      (await getProtoGuardConfigForEvaluation({ tenantOid: scope.tenant.oid })).filters.find(
        entry => entry.key === filter.key
      )?.enabled
    ).toBe(true);
  });

  it('overrides and resets a filter alert confidence threshold', async () => {
    let filter = await loadFilter('role_hijack');

    for (let threshold of [0, 1, 0.95]) {
      let setting = await protoGuardConfigService.setTenantFilterAlertConfidenceThreshold({
        instance: scope.instance,
        auditScope: scope.auditScope,
        filterId: filter.key,
        threshold
      });
      expect(setting).toMatchObject({ alertConfidenceThreshold: threshold, enabled: true });
    }

    expect(
      entryFor(
        await protoGuardConfigService.listFilters({ instance: scope.instance }),
        filter.key
      )
    ).toMatchObject({ enabled: true, alertConfidenceThreshold: 0.95 });
    expect(
      (await getProtoGuardConfigForEvaluation({ tenantOid: scope.tenant.oid })).filters.find(
        entry => entry.key === filter.key
      )?.alertConfidenceThreshold
    ).toBe(0.95);

    let reset = await protoGuardConfigService.setTenantFilterAlertConfidenceThreshold({
      instance: scope.instance,
      auditScope: scope.auditScope,
      filterId: filter.id,
      threshold: null
    });
    expect(reset.alertConfidenceThreshold).toBeNull();
    expect(
      entryFor(
        await protoGuardConfigService.listFilters({ instance: scope.instance }),
        filter.key
      ).alertConfidenceThreshold
    ).toBe(filter.alertConfidenceThreshold);
  });

  it('rejects unknown filters and invalid thresholds without writing settings', async () => {
    let before = await countSettings();
    let base = { instance: scope.instance, auditScope: scope.auditScope };

    await expectServiceError(
      protoGuardConfigService.setTenantFilterEnabled({
        ...base,
        filterId: uniqueId('missing-filter'),
        enabled: false
      }),
      'not_found'
    );
    await expectServiceError(
      protoGuardConfigService.setTenantFilterAlertConfidenceThreshold({
        ...base,
        filterId: uniqueId('missing-filter'),
        threshold: 0.5
      }),
      'not_found'
    );

    for (let threshold of [-0.1, 1.5]) {
      await expectServiceError(
        protoGuardConfigService.setTenantFilterAlertConfidenceThreshold({
          ...base,
          filterId: 'format_break',
          threshold
        }),
        'invalid_alert_confidence_threshold'
      );
    }

    for (let threshold of [0, 2.5, -1]) {
      await expectServiceError(
        protoGuardConfigService.setTenantAlertFilterCountThreshold({ ...base, threshold }),
        'invalid_alert_filter_count_threshold'
      );
    }

    expect(await countSettings()).toBe(before);
    expect(
      (await protoGuardConfigService.listFilters({ instance: scope.instance }))
        .alertFilterCountThreshold
    ).toBe(DEFAULT_PROTO_GUARD_ALERT_FILTER_COUNT_THRESHOLD);
  });

  it('keeps tenant settings out of other organizations', async () => {
    let other = await scopeOf(otherOrg);

    await protoGuardConfigService.setTenantAlertFilterCountThreshold({
      instance: scope.instance,
      auditScope: scope.auditScope,
      threshold: 4
    });
    await protoGuardConfigService.setTenantFilterEnabled({
      instance: scope.instance,
      auditScope: scope.auditScope,
      filterId: 'format_break',
      enabled: false
    });

    let own = await protoGuardConfigService.listFilters({ instance: scope.instance });
    expect(own.alertFilterCountThreshold).toBe(4);
    expect(entryFor(own, 'format_break').enabled).toBe(false);

    let foreign = await protoGuardConfigService.listFilters({ instance: other.instance });
    expect(foreign.alertFilterCountThreshold).toBe(
      DEFAULT_PROTO_GUARD_ALERT_FILTER_COUNT_THRESHOLD
    );
    expect(entryFor(foreign, 'format_break').enabled).toBe(true);
    expect(
      (await getProtoGuardConfigForEvaluation({ tenantOid: other.tenant.oid }))
        .alertFilterCountThreshold
    ).toBe(DEFAULT_PROTO_GUARD_ALERT_FILTER_COUNT_THRESHOLD);
  });
});

describe('module-monitor protoguard config in evaluation', () => {
  let org = useOrganization();
  let server = useMcpTestServer({ tools: [...defaultMcpTestTools, readNotesTool] });
  let remote = useFixture(() =>
    createRemoteProvider(org.clients.instance, { url: server.url })
  );

  it('evaluates real traffic with the tenant settings and alerts again once they are reset', async () => {
    let scope = await scopeOf(org);
    let base = { instance: scope.instance, auditScope: scope.auditScope };

    await protoGuardConfigService.setTenantFilterEnabled({
      ...base,
      filterId: 'instruction_override',
      enabled: false
    });
    await protoGuardConfigService.setTenantFilterAlertConfidenceThreshold({
      ...base,
      filterId: 'prompt_exfiltration',
      threshold: 1
    });
    await protoGuardConfigService.setTenantAlertFilterCountThreshold({
      ...base,
      threshold: 3
    });

    let opened = await openSession(org, remote.providerId);
    let suppressed = await callTool(opened, 'read_notes');
    let run = await waitForProtoGuardRun(suppressed.message.oid);

    expect(run).toMatchObject({
      status: 'completed',
      alertFilterCountThreshold: 3,
      alert: null
    });
    expect(run.triggeredFilterCount).toBeGreaterThanOrEqual(1);
    expect(run.triggeredFilterCount).toBeLessThan(3);
    expect(
      await firstPage(
        await alertService.listAlerts({
          instance: scope.instance,
          sessionMessageIds: [suppressed.message.id]
        })
      )
    ).toEqual([]);

    await protoGuardConfigService.setTenantFilterEnabled({
      ...base,
      filterId: 'instruction_override',
      enabled: true
    });
    await protoGuardConfigService.setTenantFilterAlertConfidenceThreshold({
      ...base,
      filterId: 'prompt_exfiltration',
      threshold: null
    });
    await protoGuardConfigService.setTenantAlertFilterCountThreshold({
      ...base,
      threshold: null
    });

    let alerted = await eventually(
      async () => {
        let { message } = await callTool(opened, 'read_notes');
        let run = await waitForProtoGuardRun(message.oid);
        expect(run.alert).not.toBeNull();
        return run;
      },
      { timeoutMs: 90_000, intervalMs: 3_000 }
    );
    expect(alerted.alertFilterCountThreshold).toBe(
      DEFAULT_PROTO_GUARD_ALERT_FILTER_COUNT_THRESHOLD
    );
    expect(alerted.alert!.instances.map(instance => instance.filter.key)).toEqual(
      expect.arrayContaining(['instruction_override', 'prompt_exfiltration'])
    );
  }, 300_000);
});
