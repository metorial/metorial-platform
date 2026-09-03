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
  type AuditSubspaceProtoGuardFilterSetting
} from '@metorial/fabric';

export let DEFAULT_PROTO_GUARD_ALERT_FILTER_COUNT_THRESHOLD = 2;

let CACHE_TTL_MS = 10_000;

type CachedEvaluationConfig = {
  expiresAt: number;
  alertFilterCountThreshold: number;
  filters: {
    key: string;
    oid: bigint;
    enabled: boolean;
    alertConfidenceThreshold: number;
  }[];
};

let cache = new Map<string, CachedEvaluationConfig>();

let clearTenantCache = (tenantOid: bigint) => {
  cache.delete(String(tenantOid));
};

export let getProtoGuardConfigForEvaluation = async (d: { tenantOid: bigint }) => {
  let cacheKey = String(d.tenantOid);
  let cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached;

  let [filters, tenantFilterSettings, tenantSetting] = await Promise.all([
    db.protoGuardFilter.findMany(),
    db.protoGuardTenantFilterSetting.findMany({ where: { tenantOid: d.tenantOid } }),
    db.protoGuardTenantSetting.findUnique({ where: { tenantOid: d.tenantOid } })
  ]);

  let settingByFilterOid = new Map(
    tenantFilterSettings.map(setting => [setting.filterOid, setting])
  );

  let result = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    alertFilterCountThreshold:
      tenantSetting?.alertFilterCountThreshold ??
      DEFAULT_PROTO_GUARD_ALERT_FILTER_COUNT_THRESHOLD,
    filters: filters.map(filter => {
      let setting = settingByFilterOid.get(filter.oid);

      return {
        key: filter.key,
        oid: filter.oid,
        enabled: setting?.enabled ?? filter.defaultEnabled,
        alertConfidenceThreshold:
          setting?.alertConfidenceThreshold ?? filter.alertConfidenceThreshold
      };
    })
  };

  cache.set(cacheKey, result);
  return result;
};

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
  alertConfidenceThreshold: setting?.alertConfidenceThreshold ?? filter.alertConfidenceThreshold,
  isUsingDefaultConfidenceThreshold: setting?.alertConfidenceThreshold == null
});

let toAlertThresholdAuditPayload = (
  setting: ProtoGuardTenantSetting | null
): AuditSubspaceProtoGuardAlertThreshold => ({
  settingId: setting?.id ?? null,
  alertFilterCountThreshold:
    setting?.alertFilterCountThreshold ?? DEFAULT_PROTO_GUARD_ALERT_FILTER_COUNT_THRESHOLD,
  isUsingDefault: !setting,
  defaultAlertFilterCountThreshold: DEFAULT_PROTO_GUARD_ALERT_FILTER_COUNT_THRESHOLD
});

class protoGuardConfigServiceImpl {
  async listFilters(d: MetorialFacing<ListProtoGuardFiltersParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant } = await resolveMetorialFacing({ instance, organizationActor });
    return this.listFiltersInternal({ ...rest, tenant });
  }

  async listFiltersInternal(d: ListProtoGuardFiltersParams) {
    let [filters, tenantFilterSettings, tenantSetting] = await Promise.all([
      db.protoGuardFilter.findMany({ orderBy: { key: 'asc' } }),
      db.protoGuardTenantFilterSetting.findMany({ where: { tenantOid: d.tenant.oid } }),
      db.protoGuardTenantSetting.findUnique({ where: { tenantOid: d.tenant.oid } })
    ]);

    let settingByFilterOid = new Map(
      tenantFilterSettings.map(setting => [setting.filterOid, setting])
    );

    return {
      alertFilterCountThreshold:
        tenantSetting?.alertFilterCountThreshold ??
        DEFAULT_PROTO_GUARD_ALERT_FILTER_COUNT_THRESHOLD,
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

    let filter = await db.protoGuardFilter.findFirstOrThrow({
      where: { OR: [{ id: d.filterId }, { key: d.filterId }] }
    });
    let previousSetting = await db.protoGuardTenantFilterSetting.findUnique({
      where: { tenantOid_filterOid: { tenantOid: tenant.oid, filterOid: filter.oid } }
    });

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('protoguard.filter_setting.updated:before', {
      ...eventBase,
      filterId: filter.id
    });

    let setting = await this.setTenantFilterEnabledInternal({ ...rest, tenant });

    await Fabric.fire('protoguard.filter_setting.updated:after', {
      ...eventBase,
      setting: toFilterSettingAuditPayload(filter, setting),
      previousSetting: toFilterSettingAuditPayload(filter, previousSetting)
    });

    return setting;
  }

  async setTenantFilterEnabledInternal(d: SetTenantFilterEnabledParams) {
    let filter = await db.protoGuardFilter.findFirstOrThrow({
      where: { OR: [{ id: d.filterId }, { key: d.filterId }] }
    });

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

    clearTenantCache(d.tenant.oid);
    return setting;
  }

  async setTenantFilterAlertConfidenceThreshold(
    d: MetorialFacing<SetTenantFilterAlertConfidenceThresholdParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant } = await resolveMetorialFacing({ instance, organizationActor });

    let filter = await db.protoGuardFilter.findFirstOrThrow({
      where: { OR: [{ id: d.filterId }, { key: d.filterId }] }
    });
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
      tenant
    });

    await Fabric.fire('protoguard.filter_setting.updated:after', {
      ...eventBase,
      setting: toFilterSettingAuditPayload(filter, setting),
      previousSetting: toFilterSettingAuditPayload(filter, previousSetting)
    });

    return setting;
  }

  async setTenantFilterAlertConfidenceThresholdInternal(
    d: SetTenantFilterAlertConfidenceThresholdParams
  ) {
    let filter = await db.protoGuardFilter.findFirstOrThrow({
      where: { OR: [{ id: d.filterId }, { key: d.filterId }] }
    });

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

    clearTenantCache(d.tenant.oid);
    return setting;
  }

  async setTenantAlertFilterCountThreshold(
    d: MetorialFacing<SetTenantAlertFilterCountThresholdParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant } = await resolveMetorialFacing({ instance, organizationActor });

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
    if (d.threshold === null) {
      await db.protoGuardTenantSetting.deleteMany({
        where: { tenantOid: d.tenant.oid }
      });
      clearTenantCache(d.tenant.oid);
      return null;
    }

    let setting = await db.protoGuardTenantSetting.upsert({
      where: { tenantOid: d.tenant.oid },
      update: { alertFilterCountThreshold: d.threshold },
      create: {
        ...getId('protoGuardTenantSetting'),
        tenantOid: d.tenant.oid,
        projectOid: d.tenant.projectOid,
        alertFilterCountThreshold: d.threshold
      }
    });

    clearTenantCache(d.tenant.oid);
    return setting;
  }
}

export let protoGuardConfigService = Service.create(
  'protoGuardConfigService',
  () => new protoGuardConfigServiceImpl()
).build();
