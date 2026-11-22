import { getDetectionCatalog as getAiToolCatalog } from '@metorial/model-catalog/detection';
import { describe, expect, it } from 'vitest';
import { v1AiToolPresenter } from './aiTool';
import { v1AiToolDetectionPresenter } from './aiToolDetection';
import {
  v1ConsumerDeviceDetectionCatalogPresenter,
  v1ConsumerDeviceDetectionReportPresenter
} from './consumerDeviceDetection';
import { v1ConsumerDeviceSettingsPresenter } from './consumerDeviceSettings';

let context = {
  apiVersion: 'mt_2026_01_01_magnetar',
  accessType: 'user_auth_token'
} as const;

let tool = getAiToolCatalog().tools.find(entry => entry.key == 'cursor')!;

let seenAt = new Date('2026-11-22T10:00:00Z');

let detection = {
  oid: 1n,
  id: 'codd_1',
  toolKey: 'cursor',
  state: 'installed',
  confidence: 'medium',
  signalKinds: ['app'],
  version: null,
  firstSeenAt: seenAt,
  lastSeenAt: seenAt,
  goneAt: null,
  consumerDevice: {
    id: 'codv_1',
    name: 'Ada’s MacBook Pro',
    os: 'macos',
    detectionReportedAt: new Date('2020-01-01T00:00:00Z'),
    consumerProfile: {
      id: 'cpr_1',
      consumer: { id: 'con_1', name: 'Ada', email: 'ada@example.com' }
    }
  }
} as any;

describe('AI tool presenter', () => {
  it('shows an undecided tool nobody has reported as unreviewed and unused', async () => {
    let presented = await v1AiToolPresenter
      .present(
        { aiTool: { tool, policy: null, usage: null }, telemetry: { lastUsedAt: null } },
        context
      )
      .run();

    expect(presented).toMatchObject({
      object: 'ai_tool',
      key: 'cursor',
      name: 'Cursor',
      maker: { id: 'anysphere' },
      policy: { status: 'unreviewed', note: null, decided_at: null },
      device_count: 0,
      people_count: 0,
      last_seen_at: null,
      actively_used: false,
      last_used_at: null
    });
  });

  it('shows the decision and how widely the tool is used', async () => {
    let presented = await v1AiToolPresenter
      .present(
        {
          aiTool: {
            tool,
            policy: { status: 'sanctioned', note: 'Approved', decidedAt: seenAt } as any,
            usage: {
              toolKey: 'cursor',
              deviceCount: 3,
              peopleCount: 2,
              lastSeenAt: seenAt,
              running: false
            }
          },
          telemetry: { lastUsedAt: seenAt }
        },
        context
      )
      .run();

    expect(presented).toMatchObject({
      policy: { status: 'sanctioned', note: 'Approved', decided_at: seenAt },
      device_count: 3,
      people_count: 2,
      last_seen_at: seenAt,
      actively_used: true,
      last_used_at: seenAt
    });
    expect(JSON.stringify(presented)).not.toContain('oid');
  });

  it('counts a running tool as actively used when its usage is unknown', async () => {
    let presented = await v1AiToolPresenter
      .present(
        {
          aiTool: {
            tool,
            policy: null,
            usage: {
              toolKey: 'cursor',
              deviceCount: 1,
              peopleCount: 1,
              lastSeenAt: seenAt,
              running: true
            }
          },
          telemetry: null
        },
        context
      )
      .run();

    expect(presented).toMatchObject({ actively_used: true, last_used_at: null });
  });

  it('reports unknown use for a tool that is not running when usage is unknown', async () => {
    let presented = await v1AiToolPresenter
      .present({ aiTool: { tool, policy: null, usage: null }, telemetry: null }, context)
      .run();

    expect(presented).toMatchObject({ actively_used: null, last_used_at: null });
  });
});

describe('AI tool detection presenter', () => {
  it('names the device, its consumer and the tool status, and flags a silent device as stale', async () => {
    let presented = await v1AiToolDetectionPresenter
      .present(
        { detection, policy: { status: 'not_sanctioned' }, telemetry: { lastUsedAt: null } },
        context
      )
      .run();

    expect(presented).toEqual({
      object: 'ai_tool.detection',
      id: 'codd_1',
      tool_key: 'cursor',
      tool_name: 'Cursor',
      state: 'installed',
      confidence: 'medium',
      signal_kinds: ['app'],
      version: null,
      stale: true,
      first_seen_at: seenAt,
      last_seen_at: seenAt,
      policy_status: 'not_sanctioned',
      consumer_device_id: 'codv_1',
      consumer_device_name: 'Ada’s MacBook Pro',
      consumer_device_os: 'macos',
      consumer_profile_id: 'cpr_1',
      consumer_id: 'con_1',
      consumer_name: 'Ada',
      consumer_email: 'ada@example.com',
      gone_at: null,
      actively_used: false,
      last_used_at: null
    });
  });

  it('counts a running tool or recent usage as actively used, but not a gone one', async () => {
    let present = (
      overrides: Record<string, unknown>,
      telemetry: { lastUsedAt: Date | null } | null
    ) =>
      v1AiToolDetectionPresenter
        .present(
          { detection: { ...detection, ...overrides }, policy: null, telemetry },
          context
        )
        .run();

    expect((await present({ state: 'running' }, null)).actively_used).toBe(true);
    expect((await present({ state: 'running', goneAt: seenAt }, null)).actively_used).toBe(
      null
    );
    expect(
      (await present({ state: 'running', goneAt: seenAt }, { lastUsedAt: null })).actively_used
    ).toBe(false);
    expect(await present({}, { lastUsedAt: seenAt })).toMatchObject({
      actively_used: true,
      last_used_at: seenAt
    });
  });
});

describe('detection report and catalog presenters', () => {
  it('returns the accepted sequence and what the device reported', async () => {
    let presented = await v1ConsumerDeviceDetectionReportPresenter
      .present(
        {
          consumerDevice: {
            id: 'codv_1',
            detectionSeq: 7,
            detectionReportedAt: new Date(),
            detections: [detection]
          } as any,
          applied: false
        },
        context
      )
      .run();

    expect(presented).toMatchObject({
      object: 'consumer.device.detection_report',
      consumer_device_id: 'codv_1',
      applied: false,
      seq: 7,
      catalog_version: getAiToolCatalog().version,
      detections: [{ object: 'consumer.device.detection', tool_key: 'cursor', stale: false }]
    });
  });

  it('publishes the catalog the device matches against', async () => {
    let catalog = getAiToolCatalog();
    let presented = await v1ConsumerDeviceDetectionCatalogPresenter
      .present({ catalog }, context)
      .run();

    expect(presented.object).toBe('consumer.device.detection_catalog');
    expect(presented.version).toBe(catalog.version);
    expect(presented.tools.find(entry => entry.key == 'cursor')?.platforms.macos.apps).toEqual(
      ['Cursor.app']
    );
  });
});

describe('consumer device settings presenter', () => {
  it('presents defaults for an instance that never changed its settings', async () => {
    let presented = await v1ConsumerDeviceSettingsPresenter
      .present({ instance: { id: 'inst_1' }, settings: null }, context)
      .run();

    expect(presented).toEqual({
      object: 'consumer.device_settings',
      instance_id: 'inst_1',
      ai_tool_detection_enabled: false,
      privacy_notice_accepted_at: null,
      updated_at: null
    });
  });
});
