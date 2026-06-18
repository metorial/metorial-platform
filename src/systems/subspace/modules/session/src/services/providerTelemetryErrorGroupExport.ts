import { createValidatedEnv } from '@lowerdeck/env';
import { v } from '@lowerdeck/validation';
import { ObjectStorageClient } from 'object-storage-client';
import {
  listAdminProviderTelemetryErrorGroups,
  type AdminProviderTelemetryErrorGroup,
  type AdminProviderTelemetryErrorGroupList,
  type AdminProviderTelemetryErrorGroupListInput
} from './adminProviderTelemetryErrorGroup';

export let PROVIDER_TELEMETRY_ERROR_GROUPS_STATE_KEY =
  'provider-telemetry/error-groups/state.json';

export type ProviderTelemetryErrorGroupsExportWatermark = {
  created_at: string;
  id: string;
};

export type ProviderTelemetryErrorGroupsExportState = {
  version: 1;
  last_exported: ProviderTelemetryErrorGroupsExportWatermark | null;
  last_checked_at: string;
  last_export_key?: string;
};

export type ProviderTelemetryErrorGroupsExportFile = {
  object: 'admin.provider_error_groups_export';
  version: 1;
  generated_at: string;
  range: {
    from: Date;
    to: Date;
  };
  watermark_before: ProviderTelemetryErrorGroupsExportWatermark | null;
  watermark_after: ProviderTelemetryErrorGroupsExportWatermark | null;
  count: number;
  items: AdminProviderTelemetryErrorGroup[];
};

type ProviderTelemetryErrorGroupsExportStorage = {
  upsertBucket(bucket: string): Promise<unknown>;
  getObject(bucket: string, key: string): Promise<{ data: Buffer | Uint8Array | string }>;
  putObject(
    bucket: string,
    key: string,
    data: Buffer | Uint8Array | Blob | ReadableStream | string,
    contentType?: string,
    metadata?: Record<string, string>
  ): Promise<unknown>;
};

export type ProviderTelemetryErrorGroupsExportDeps = {
  now?: Date;
  bucketName?: string;
  storage?: ProviderTelemetryErrorGroupsExportStorage;
  listErrorGroups?: (
    input: AdminProviderTelemetryErrorGroupListInput
  ) => Promise<AdminProviderTelemetryErrorGroupList>;
};

let getExporterEnv = () =>
  createValidatedEnv({
    storage: {
      OBJECT_STORAGE_URL: v.string(),
      PROVIDER_TELEMETRY_ERROR_GROUPS_BUCKET_NAME: v.string()
    }
  }).storage;

let getDefaultStorage = () => {
  let env = getExporterEnv();
  return {
    bucketName: env.PROVIDER_TELEMETRY_ERROR_GROUPS_BUCKET_NAME,
    storage: new ObjectStorageClient(env.OBJECT_STORAGE_URL)
  };
};

let objectDataToString = (data: Buffer | Uint8Array | string) => {
  if (typeof data === 'string') return data;
  return Buffer.from(data).toString('utf8');
};

let isNotFoundError = (error: unknown) =>
  !!error &&
  typeof error === 'object' &&
  'statusCode' in error &&
  (error as { statusCode?: number }).statusCode === 404;

export let readProviderTelemetryErrorGroupsExportState = async (d: {
  storage: ProviderTelemetryErrorGroupsExportStorage;
  bucketName: string;
}) => {
  try {
    let object = await d.storage.getObject(
      d.bucketName,
      PROVIDER_TELEMETRY_ERROR_GROUPS_STATE_KEY
    );
    return JSON.parse(
      objectDataToString(object.data)
    ) as ProviderTelemetryErrorGroupsExportState;
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
};

export let getProviderTelemetryErrorGroupsExportKey = (now: Date) => {
  let [year, month, day] = now.toISOString().slice(0, 10).split('-');
  let timestamp = now.toISOString().replace(/[:.]/g, '-');
  return `provider-telemetry/error-groups/runs/${year}/${month}/${day}/${timestamp}.json`;
};

export let watermarkFromProviderTelemetryErrorGroup = (
  item: Pick<AdminProviderTelemetryErrorGroup, 'created_at' | 'id'>
): ProviderTelemetryErrorGroupsExportWatermark => ({
  created_at:
    item.created_at instanceof Date ? item.created_at.toISOString() : item.created_at,
  id: item.id
});

export let isProviderTelemetryErrorGroupAfterWatermark = (
  item: Pick<AdminProviderTelemetryErrorGroup, 'created_at' | 'id'>,
  watermark: ProviderTelemetryErrorGroupsExportWatermark | null | undefined
) => {
  if (!watermark) return true;

  let itemCreatedAt =
    item.created_at instanceof Date ? item.created_at.toISOString() : item.created_at;
  if (itemCreatedAt > watermark.created_at) return true;
  if (itemCreatedAt < watermark.created_at) return false;

  return item.id > watermark.id;
};

let getExportRange = (
  watermark: ProviderTelemetryErrorGroupsExportWatermark | null | undefined,
  now: Date
) => ({
  from: watermark
    ? new Date(watermark.created_at)
    : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
  to: now
});

let collectNewErrorGroups = async (d: {
  listErrorGroups: ProviderTelemetryErrorGroupsExportDeps['listErrorGroups'];
  watermark: ProviderTelemetryErrorGroupsExportWatermark | null;
  range: { from: Date; to: Date };
}) => {
  let items: AdminProviderTelemetryErrorGroup[] = [];
  let after: string | undefined;
  let listErrorGroups = d.listErrorGroups ?? listAdminProviderTelemetryErrorGroups;

  while (true) {
    let page = await listErrorGroups({
      range: d.range,
      limit: 100,
      order: 'desc',
      after
    });

    let reachedWatermark = false;
    for (let item of page.items) {
      if (isProviderTelemetryErrorGroupAfterWatermark(item, d.watermark)) {
        items.push(item);
      } else {
        reachedWatermark = true;
      }
    }

    if (reachedWatermark || !page.pagination.has_more_after || page.items.length === 0) {
      break;
    }

    after = page.items[page.items.length - 1]!.id;
  }

  return items;
};

let writeJsonObject = async (d: {
  storage: ProviderTelemetryErrorGroupsExportStorage;
  bucketName: string;
  key: string;
  value: unknown;
  metadata?: Record<string, string>;
}) => {
  await d.storage.putObject(
    d.bucketName,
    d.key,
    JSON.stringify(d.value, null, 2),
    'application/json',
    d.metadata
  );
};

export let runProviderTelemetryErrorGroupsExport = async (
  deps: ProviderTelemetryErrorGroupsExportDeps = {}
) => {
  let defaults = deps.storage && deps.bucketName ? null : getDefaultStorage();
  let storage = deps.storage ?? defaults!.storage;
  let bucketName = deps.bucketName ?? defaults!.bucketName;
  let now = deps.now ?? new Date();

  await storage.upsertBucket(bucketName);

  let state = await readProviderTelemetryErrorGroupsExportState({ storage, bucketName });
  let watermarkBefore = state?.last_exported ?? null;
  let range = getExportRange(watermarkBefore, now);
  let items = await collectNewErrorGroups({
    listErrorGroups: deps.listErrorGroups,
    watermark: watermarkBefore,
    range
  });

  let exportKey: string | undefined;
  let watermarkAfter = items.length
    ? watermarkFromProviderTelemetryErrorGroup(items[0]!)
    : watermarkBefore;

  if (items.length) {
    exportKey = getProviderTelemetryErrorGroupsExportKey(now);
    let exportFile: ProviderTelemetryErrorGroupsExportFile = {
      object: 'admin.provider_error_groups_export',
      version: 1,
      generated_at: now.toISOString(),
      range,
      watermark_before: watermarkBefore,
      watermark_after: watermarkAfter,
      count: items.length,
      items
    };

    await writeJsonObject({
      storage,
      bucketName,
      key: exportKey,
      value: exportFile,
      metadata: {
        type: 'provider-telemetry-error-groups-export'
      }
    });
  }

  let nextState: ProviderTelemetryErrorGroupsExportState = {
    version: 1,
    last_exported: watermarkAfter,
    last_checked_at: now.toISOString(),
    last_export_key: exportKey ?? state?.last_export_key
  };

  await writeJsonObject({
    storage,
    bucketName,
    key: PROVIDER_TELEMETRY_ERROR_GROUPS_STATE_KEY,
    value: nextState,
    metadata: {
      type: 'provider-telemetry-error-groups-state'
    }
  });

  return {
    exportKey,
    state: nextState,
    exportedCount: items.length
  };
};
