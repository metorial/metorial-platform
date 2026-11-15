import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  db,
  getId,
  type ProtoGuardFilter,
  type ProtoGuardTenantFilterSetting,
  type ProtoGuardTenantSetting,
  type Tenant
} from '@metorial-subspace/db';
import {
  toProviderEventBase,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import {
  Fabric,
  type AuditSubspaceProtoGuardAlertThreshold,
  type AuditSubspaceProtoGuardFilterSetting,
  type AuditSubspaceProtoGuardTenantSetting
} from '@metorial/fabric';

export let DEFAULT_PROTO_GUARD_ALERT_FILTER_COUNT_THRESHOLD = 2;
export let DEFAULT_PROTO_GUARD_ALERT_PROBABILITY_THRESHOLD = 0.8;

let GLOBAL_FILTERS_CACHE_TTL_SECONDS = 60;
let TENANT_CONFIG_CACHE_TTL_SECONDS = 10;

let getGlobalFilters = createLocallyCachedFunction({
  getHash: () => 'filters',
  provider: async () =>
    db.protoGuardFilter.findMany({
      select: {
        oid: true,
        key: true,
        defaultEnabled: true,
        alertConfidenceThreshold: true,
        scoreWeight: true,
        stage: true
      }
    }),
  ttlSeconds: GLOBAL_FILTERS_CACHE_TTL_SECONDS
});

// A missing row means the tenant never touched ProtoGuard, which is the default-on state.
let resolveTenantSetting = (setting: ProtoGuardTenantSetting | null) => ({
  enabled: setting?.enabled ?? true,
  alertProbabilityThreshold:
    setting?.alertProbabilityThreshold ?? DEFAULT_PROTO_GUARD_ALERT_PROBABILITY_THRESHOLD,
  alertFilterCountThreshold:
    setting?.alertFilterCountThreshold ?? DEFAULT_PROTO_GUARD_ALERT_FILTER_COUNT_THRESHOLD,
  isAlertFilterCountCustom: setting?.alertFilterCountThreshold != null
});

let getTenantConfig = createLocallyCachedFunction({
  getHash: (d: { tenantOid: bigint }) => String(d.tenantOid),
  provider: async (d: { tenantOid: bigint }) => {
    let [filters, tenantFilterSettings, tenantSetting] = await Promise.all([
      getGlobalFilters(undefined),
      db.protoGuardTenantFilterSetting.findMany({ where: { tenantOid: d.tenantOid } }),
      db.protoGuardTenantSetting.findUnique({ where: { tenantOid: d.tenantOid } })
    ]);

    let settingByFilterOid = new Map(
      tenantFilterSettings.map(setting => [setting.filterOid, setting])
    );

    return {
      ...resolveTenantSetting(tenantSetting),
      filters: filters.map(filter => {
        let setting = settingByFilterOid.get(filter.oid);

        return {
          key: filter.key,
          oid: filter.oid,
          stage: filter.stage,
          scoreWeight: filter.scoreWeight,
          enabled: setting?.enabled ?? filter.defaultEnabled,
          alertConfidenceThreshold:
            setting?.alertConfidenceThreshold ?? filter.alertConfidenceThreshold
        };
      })
    };
  },
  ttlSeconds: TENANT_CONFIG_CACHE_TTL_SECONDS
});

let clearTenantCache = (tenantOid: bigint) => getTenantConfig.clearAndWait({ tenantOid });

let findFilter = async (filterId: string) => {
  let filter = await db.protoGuardFilter.findFirst({
    where: { OR: [{ id: filterId }, { key: filterId }] }
  });
  if (!filter) throw new ServiceError(notFoundError('protoguard_filter', filterId));

  return filter;
};

let assertAlertConfidenceThreshold = (threshold: number | null) => {
  if (threshold === null) return;
  if (Number.isFinite(threshold) && threshold >= 0 && threshold <= 1) return;

  throw new ServiceError(
    badRequestError({
      code: 'invalid_alert_confidence_threshold',
      message: 'The alert confidence threshold must be a number between 0 and 1.'
    })
  );
};

let assertAlertProbabilityThreshold = (threshold: number | null | undefined) => {
  if (threshold == null) return;
  if (Number.isFinite(threshold) && threshold > 0 && threshold <= 1) return;

  throw new ServiceError(
    badRequestError({
      code: 'invalid_alert_probability_threshold',
      message: 'The alert probability threshold must be a number above 0 and at most 1.'
    })
  );
};

let assertAlertFilterCountThreshold = (threshold: number | null | undefined) => {
  if (threshold == null) return;
  if (Number.isInteger(threshold) && threshold >= 1) return;

  throw new ServiceError(
    badRequestError({
      code: 'invalid_alert_filter_count_threshold',
      message: 'The alert filter count threshold must be a whole number of at least 1.'
    })
  );
};

export let getProtoGuardConfigForEvaluation = async (d: { tenantOid: bigint }) =>
  getTenantConfig({ tenantOid: d.tenantOid });

export type ListProtoGuardFiltersParams = { tenant: Tenant };
export type SetTenantFilterEnabledParams = {
  tenant: Tenant;
  filterId: string;
  enabled: boolean;
};
export type SetTenantFilterAlertConfidenceThresholdParams = {
  tenant: Tenant;
  filterId: string;
  threshold: number | null;
};
export type SetTenantAlertFilterCountThresholdParams = {
  tenant: Tenant;
  threshold: number | null;
};

export type UpdateTenantSettingsParams = {
  tenant: Tenant;
  input: {
    enabled?: boolean;
    alertProbabilityThreshold?: number | null;
    alertFilterCountThreshold?: number | null;
  };
};

let toFilterSettingAuditPayload = (
  filter: ProtoGuardFilter,
  setting: ProtoGuardTenantFilterSetting | null
): AuditSubspaceProtoGuardFilterSetting => ({
  filter: {
    id: filter.id,
    key: filter.key,
    name: filter.name,
    description: filter.description,
    issueType: filter.issueType,
    severity: filter.severity,
    scoreWeight: filter.scoreWeight,
    defaultEnabled: filter.defaultEnabled,
    defaultAlertConfidenceThreshold: filter.alertConfidenceThreshold
  },
  settingId: setting?.id ?? null,
  enabled: setting?.enabled ?? filter.defaultEnabled,
  isUsingDefaultEnabled: !setting,
  alertConfidenceThreshold:
    setting?.alertConfidenceThreshold ?? filter.alertConfidenceThreshold,
  isUsingDefaultConfidenceThreshold: setting?.alertConfidenceThreshold == null
});

let toAlertThresholdAuditPayload = (
  setting: ProtoGuardTenantSetting | null
): AuditSubspaceProtoGuardAlertThreshold => ({
  settingId: setting?.id ?? null,
  alertFilterCountThreshold:
    setting?.alertFilterCountThreshold ?? DEFAULT_PROTO_GUARD_ALERT_FILTER_COUNT_THRESHOLD,
  isUsingDefault: setting?.alertFilterCountThreshold == null,
  defaultAlertFilterCountThreshold: DEFAULT_PROTO_GUARD_ALERT_FILTER_COUNT_THRESHOLD
});

let toTenantSettingAuditPayload = (
  setting: ProtoGuardTenantSetting | null
): AuditSubspaceProtoGuardTenantSetting => ({
  settingId: setting?.id ?? null,
  ...resolveTenantSetting(setting),
  isUsingDefaultProbabilityThreshold: setting?.alertProbabilityThreshold == null,
  defaultAlertProbabilityThreshold: DEFAULT_PROTO_GUARD_ALERT_PROBABILITY_THRESHOLD,
  isUsingDefaultFilterCountThreshold: setting?.alertFilterCountThreshold == null,
  defaultAlertFilterCountThreshold: DEFAULT_PROTO_GUARD_ALERT_FILTER_COUNT_THRESHOLD
});

class ProtoGuardConfigServiceImpl {
  async listFilters(d: MetorialFacing<ListProtoGuardFiltersParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant } = await resolveMetorialFacing({ instance, organizationActor });
    return this.listFiltersInternal({ ...rest, tenant });
  }

  async listFiltersInternal(d: ListProtoGuardFiltersParams) {
    let [filters, tenantFilterSettings, tenantSetting] = await Promise.all([
      db.protoGuardFilter.findMany({ where: { stage: 'active' }, orderBy: { key: 'asc' } }),
      db.protoGuardTenantFilterSetting.findMany({ where: { tenantOid: d.tenant.oid } }),
      db.protoGuardTenantSetting.findUnique({ where: { tenantOid: d.tenant.oid } })
    ]);

    let settingByFilterOid = new Map(
      tenantFilterSettings.map(setting => [setting.filterOid, setting])
    );

    return {
      ...resolveTenantSetting(tenantSetting),
      filters: filters.map(filter => {
        let setting = settingByFilterOid.get(filter.oid);

        return {
          filter,
          enabled: setting?.enabled ?? filter.defaultEnabled,
          alertConfidenceThreshold:
            setting?.alertConfidenceThreshold ?? filter.alertConfidenceThreshold
        };
      })
    };
  }

  async setTenantFilterEnabled(d: MetorialFacing<SetTenantFilterEnabledParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant } = await resolveMetorialFacing({ instance, organizationActor });

    let filter = await findFilter(d.filterId);
    let previousSetting = await db.protoGuardTenantFilterSetting.findUnique({
      where: { tenantOid_filterOid: { tenantOid: tenant.oid, filterOid: filter.oid } }
    });

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('protoguard.filter_setting.updated:before', {
      ...eventBase,
      filterId: filter.id
    });

    let setting = await this.setTenantFilterEnabledInternal({ ...rest, tenant, filter });

    await Fabric.fire('protoguard.filter_setting.updated:after', {
      ...eventBase,
      setting: toFilterSettingAuditPayload(filter, setting),
      previousSetting: toFilterSettingAuditPayload(filter, previousSetting)
    });

    return setting;
  }

  async setTenantFilterEnabledInternal(
    d: SetTenantFilterEnabledParams & { filter?: ProtoGuardFilter }
  ) {
    let filter = d.filter ?? (await findFilter(d.filterId));

    let setting = await db.protoGuardTenantFilterSetting.upsert({
      where: {
        tenantOid_filterOid: {
          tenantOid: d.tenant.oid,
          filterOid: filter.oid
        }
      },
      update: { enabled: d.enabled },
      create: {
        ...getId('protoGuardTenantFilterSetting'),
        tenantOid: d.tenant.oid,
        projectOid: d.tenant.projectOid,
        filterOid: filter.oid,
        enabled: d.enabled
      }
    });

    await clearTenantCache(d.tenant.oid);
    return setting;
  }

  async setTenantFilterAlertConfidenceThreshold(
    d: MetorialFacing<SetTenantFilterAlertConfidenceThresholdParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant } = await resolveMetorialFacing({ instance, organizationActor });

    assertAlertConfidenceThreshold(d.threshold);

    let filter = await findFilter(d.filterId);
    let previousSetting = await db.protoGuardTenantFilterSetting.findUnique({
      where: { tenantOid_filterOid: { tenantOid: tenant.oid, filterOid: filter.oid } }
    });

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('protoguard.filter_setting.updated:before', {
      ...eventBase,
      filterId: filter.id
    });

    let setting = await this.setTenantFilterAlertConfidenceThresholdInternal({
      ...rest,
      tenant,
      filter
    });

    await Fabric.fire('protoguard.filter_setting.updated:after', {
      ...eventBase,
      setting: toFilterSettingAuditPayload(filter, setting),
      previousSetting: toFilterSettingAuditPayload(filter, previousSetting)
    });

    return setting;
  }

  async setTenantFilterAlertConfidenceThresholdInternal(
    d: SetTenantFilterAlertConfidenceThresholdParams & { filter?: ProtoGuardFilter }
  ) {
    assertAlertConfidenceThreshold(d.threshold);

    let filter = d.filter ?? (await findFilter(d.filterId));

    let setting = await db.protoGuardTenantFilterSetting.upsert({
      where: {
        tenantOid_filterOid: {
          tenantOid: d.tenant.oid,
          filterOid: filter.oid
        }
      },
      update: { alertConfidenceThreshold: d.threshold },
      create: {
        ...getId('protoGuardTenantFilterSetting'),
        tenantOid: d.tenant.oid,
        projectOid: d.tenant.projectOid,
        filterOid: filter.oid,
        enabled: filter.defaultEnabled,
        alertConfidenceThreshold: d.threshold
      }
    });

    await clearTenantCache(d.tenant.oid);
    return setting;
  }

  async setTenantAlertFilterCountThreshold(
    d: MetorialFacing<SetTenantAlertFilterCountThresholdParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant } = await resolveMetorialFacing({ instance, organizationActor });

    assertAlertFilterCountThreshold(d.threshold);

    let previousSetting = await db.protoGuardTenantSetting.findUnique({
      where: { tenantOid: tenant.oid }
    });

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('protoguard.alert_threshold.updated:before', eventBase);

    let setting = await this.setTenantAlertFilterCountThresholdInternal({ ...rest, tenant });

    await Fabric.fire('protoguard.alert_threshold.updated:after', {
      ...eventBase,
      threshold: toAlertThresholdAuditPayload(setting),
      previousThreshold: toAlertThresholdAuditPayload(previousSetting)
    });

    return setting;
  }

  async setTenantAlertFilterCountThresholdInternal(
    d: SetTenantAlertFilterCountThresholdParams
  ) {
    return this.updateTenantSettingsInternal({
      tenant: d.tenant,
      input: { alertFilterCountThreshold: d.threshold }
    });
  }

  async updateTenantSettings(d: MetorialFacing<UpdateTenantSettingsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant } = await resolveMetorialFacing({ instance, organizationActor });

    assertAlertProbabilityThreshold(d.input.alertProbabilityThreshold);
    assertAlertFilterCountThreshold(d.input.alertFilterCountThreshold);

    let previousSetting = await db.protoGuardTenantSetting.findUnique({
      where: { tenantOid: tenant.oid }
    });

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('protoguard.tenant_setting.updated:before', eventBase);

    let setting = await this.updateTenantSettingsInternal({ ...rest, tenant });

    await Fabric.fire('protoguard.tenant_setting.updated:after', {
      ...eventBase,
      setting: toTenantSettingAuditPayload(setting),
      previousSetting: toTenantSettingAuditPayload(previousSetting)
    });

    return setting;
  }

  async updateTenantSettingsInternal(d: UpdateTenantSettingsParams) {
    assertAlertProbabilityThreshold(d.input.alertProbabilityThreshold);
    assertAlertFilterCountThreshold(d.input.alertFilterCountThreshold);

    let data = {
      enabled: d.input.enabled,
      alertProbabilityThreshold: d.input.alertProbabilityThreshold,
      alertFilterCountThreshold: d.input.alertFilterCountThreshold
    };

    let setting = await db.protoGuardTenantSetting.upsert({
      where: { tenantOid: d.tenant.oid },
      update: data,
      create: {
        ...getId('protoGuardTenantSetting'),
        tenantOid: d.tenant.oid,
        projectOid: d.tenant.projectOid,
        ...data
      }
    });

    let isDefault =
      setting.enabled &&
      setting.alertProbabilityThreshold == null &&
      setting.alertFilterCountThreshold == null &&
      setting.contentHashKey == null;

    // The row also carries the tenant's content hash key, so it can only go while that is unset.
    if (isDefault) await db.protoGuardTenantSetting.delete({ where: { oid: setting.oid } });

    await clearTenantCache(d.tenant.oid);
    return isDefault ? null : setting;
  }
}

export let protoGuardConfigService = Service.create(
  'protoGuardConfigService',
  () => new ProtoGuardConfigServiceImpl()
).build();
