import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial-subspace/db', () => ({ db: {} }));

import {
  PROVIDER_TELEMETRY_ERROR_GROUPS_STATE_KEY,
  runProviderTelemetryErrorGroupsExport,
  type ProviderTelemetryErrorGroupsExportState
} from './providerTelemetryErrorGroupExport';
import type {
  AdminProviderTelemetryErrorGroup,
  AdminProviderTelemetryErrorGroupListInput
} from './adminProviderTelemetryErrorGroup';

let createStorage = (state?: ProviderTelemetryErrorGroupsExportState | null) => ({
  upsertBucket: vi.fn(async (_bucket: string) => ({})),
  getObject: vi.fn(async (_bucket: string, key: string) => {
    if (key !== PROVIDER_TELEMETRY_ERROR_GROUPS_STATE_KEY || state === undefined) {
      throw { statusCode: 404 };
    }

    return { data: Buffer.from(JSON.stringify(state)) };
  }),
  putObject: vi.fn(
    async (
      _bucket: string,
      _key: string,
      _data: Buffer | Uint8Array | Blob | ReadableStream | string,
      _contentType?: string,
      _metadata?: Record<string, string>
    ) => ({})
  )
});

let createItem = (id: string, createdAt: string): AdminProviderTelemetryErrorGroup => ({
  object: 'admin.provider_error_group',
  id,
  type: 'message_processing_provider_error',
  code: 'provider_error',
  message: `Message ${id}`,
  hash: `hash-${id}`,
  occurrence_count: 1,
  provider: null,
  first_occurrence_id: null,
  first_session_id: null,
  first_provider_run_id: null,
  tenant_id: 'ten_1',
  environment_id: 'ken_1',
  periods: [],
  created_at: new Date(createdAt)
});

let parseJsonCall = (call: any[]) => JSON.parse(call[2]);

describe('runProviderTelemetryErrorGroupsExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('treats a missing state object as a first run and exports the default 7-day range', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage(undefined);
    let item = createItem('serg_new', '2026-06-18T00:10:00.000Z');
    let listErrorGroups = vi.fn(async (_input: AdminProviderTelemetryErrorGroupListInput) => ({
      object: 'list' as const,
      items: [item],
      pagination: { has_more_after: false, has_more_before: false }
    }));

    let result = await runProviderTelemetryErrorGroupsExport({
      now,
      storage,
      bucketName: 'exports',
      listErrorGroups
    });

    expect(storage.upsertBucket).toHaveBeenCalledWith('exports');
    expect(listErrorGroups).toHaveBeenCalledWith({
      range: {
        from: new Date('2026-06-11T00:15:00.000Z'),
        to: now
      },
      limit: 100,
      order: 'desc',
      after: undefined
    });
    expect(storage.putObject).toHaveBeenCalledTimes(2);
    expect(storage.putObject.mock.calls[0]![1]).toBe(
      'provider-telemetry/error-groups/runs/2026/06/18/2026-06-18T00-15-00-000Z.json'
    );
    expect(storage.putObject.mock.calls[1]![1]).toBe(
      PROVIDER_TELEMETRY_ERROR_GROUPS_STATE_KEY
    );

    let exportFile = parseJsonCall(storage.putObject.mock.calls[0]!);
    expect(exportFile).toMatchObject({
      object: 'admin.provider_error_groups_export',
      version: 1,
      generated_at: '2026-06-18T00:15:00.000Z',
      watermark_before: null,
      watermark_after: {
        created_at: '2026-06-18T00:10:00.000Z',
        id: 'serg_new'
      },
      count: 1
    });
    expect(exportFile.items).toHaveLength(1);

    let stateFile = parseJsonCall(storage.putObject.mock.calls[1]!);
    expect(stateFile).toEqual({
      version: 1,
      last_exported: {
        created_at: '2026-06-18T00:10:00.000Z',
        id: 'serg_new'
      },
      last_checked_at: '2026-06-18T00:15:00.000Z',
      last_export_key:
        'provider-telemetry/error-groups/runs/2026/06/18/2026-06-18T00-15-00-000Z.json'
    });
    expect(result.exportedCount).toBe(1);
  });

  it('skips rows at or before the existing high-water mark', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage({
      version: 1,
      last_exported: {
        created_at: '2026-06-18T00:00:00.000Z',
        id: 'serg_b'
      },
      last_checked_at: '2026-06-18T00:00:00.000Z',
      last_export_key: 'previous.json'
    });
    let listErrorGroups = vi.fn(async (_input: AdminProviderTelemetryErrorGroupListInput) => ({
      object: 'list' as const,
      items: [
        createItem('serg_c', '2026-06-18T00:00:00.000Z'),
        createItem('serg_b', '2026-06-18T00:00:00.000Z'),
        createItem('serg_a', '2026-06-17T23:59:00.000Z')
      ],
      pagination: { has_more_after: true, has_more_before: false }
    }));

    await runProviderTelemetryErrorGroupsExport({
      now,
      storage,
      bucketName: 'exports',
      listErrorGroups
    });

    expect(listErrorGroups).toHaveBeenCalledTimes(1);
    expect(listErrorGroups.mock.calls[0]![0].range).toEqual({
      from: new Date('2026-06-18T00:00:00.000Z'),
      to: now
    });

    let exportFile = parseJsonCall(storage.putObject.mock.calls[0]!);
    expect(exportFile.items.map((item: AdminProviderTelemetryErrorGroup) => item.id)).toEqual([
      'serg_c'
    ]);
    expect(exportFile.watermark_before).toEqual({
      created_at: '2026-06-18T00:00:00.000Z',
      id: 'serg_b'
    });
    expect(exportFile.watermark_after).toEqual({
      created_at: '2026-06-18T00:00:00.000Z',
      id: 'serg_c'
    });
  });

  it('updates only state when there are no new rows', async () => {
    let now = new Date('2026-06-18T00:15:00.000Z');
    let storage = createStorage({
      version: 1,
      last_exported: {
        created_at: '2026-06-18T00:00:00.000Z',
        id: 'serg_b'
      },
      last_checked_at: '2026-06-18T00:00:00.000Z',
      last_export_key: 'previous.json'
    });
    let listErrorGroups = vi.fn(async (_input: AdminProviderTelemetryErrorGroupListInput) => ({
      object: 'list' as const,
      items: [createItem('serg_b', '2026-06-18T00:00:00.000Z')],
      pagination: { has_more_after: false, has_more_before: false }
    }));

    let result = await runProviderTelemetryErrorGroupsExport({
      now,
      storage,
      bucketName: 'exports',
      listErrorGroups
    });

    expect(storage.putObject).toHaveBeenCalledTimes(1);
    expect(storage.putObject.mock.calls[0]![1]).toBe(
      PROVIDER_TELEMETRY_ERROR_GROUPS_STATE_KEY
    );
    expect(parseJsonCall(storage.putObject.mock.calls[0]!)).toEqual({
      version: 1,
      last_exported: {
        created_at: '2026-06-18T00:00:00.000Z',
        id: 'serg_b'
      },
      last_checked_at: '2026-06-18T00:15:00.000Z',
      last_export_key: 'previous.json'
    });
    expect(result.exportKey).toBeUndefined();
    expect(result.exportedCount).toBe(0);
  });
});
