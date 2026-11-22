import { describe, expect, it } from 'vitest';
import { getDetectionCatalog } from '@metorial/model-catalog/detection';
import { consumerConsumerDevicePresenter, v1ConsumerDevicePresenter } from './consumerDevice';

let context = {
  apiVersion: 'mt_2026_04_01_consumer',
  accessType: 'user_auth_token'
} as const;

let deviceMonitor = (d: { aiToolDetection: boolean }) => ({
  aiToolDetection: d.aiToolDetection,
  catalogVersion: getDetectionCatalog().version,
  intervals: {
    configDirs: 300,
    apps: 3600,
    binaries: 3600,
    ideExtensions: 3600,
    processes: 900,
    report: 86400
  }
});

let monitor = deviceMonitor({ aiToolDetection: false });

let consumerDevice = {
  id: 'codv_1',
  status: 'active',
  name: "Ada's MacBook Pro",
  os: 'macos',
  arch: 'aarch64',
  appVersion: '0.2.0',
  clients: [],
  detections: [],
  consumerProfile: { id: 'cpr_1' },
  lastSeenAt: new Date(),
  revokedAt: null,
  createdAt: new Date(),
  updatedAt: new Date()
} as any;

describe('consumer device telemetry', () => {
  it('shows the telemetry state to the consumer', async () => {
    let device = await consumerConsumerDevicePresenter
      .present(
        { consumerDevice, telemetry: { enabled: true, tokenId: 'git_1' }, monitor },
        context
      )
      .run();

    expect(device).toMatchObject({
      object: 'consumer.device',
      id: 'codv_1',
      telemetry: { enabled: true, token_id: 'git_1' }
    });
  });

  it('keeps the telemetry state out of the public and dashboard device', async () => {
    let device = await v1ConsumerDevicePresenter
      .present(
        { consumerDevice, telemetry: { enabled: true, tokenId: 'git_1' }, monitor },
        { ...context, apiVersion: 'mt_2026_01_01_magnetar' }
      )
      .run();

    expect(device).not.toHaveProperty('telemetry');
    expect(device).not.toHaveProperty('monitor');
  });

  it('refuses to present a consumer device without its telemetry state', async () => {
    await expect(
      consumerConsumerDevicePresenter.present({ consumerDevice, monitor }, context).run()
    ).rejects.toThrow('telemetry state');
  });
});

describe('consumer device monitor', () => {
  it('tells the device what to monitor and how often', async () => {
    let device = await consumerConsumerDevicePresenter
      .present(
        {
          consumerDevice,
          telemetry: { enabled: false, tokenId: null },
          monitor: deviceMonitor({ aiToolDetection: true })
        },
        context
      )
      .run();

    expect(device.monitor).toEqual({
      ai_tool_detection: true,
      catalog_version: monitor.catalogVersion,
      intervals: {
        config_dirs: 300,
        apps: 3600,
        binaries: 3600,
        ide_extensions: 3600,
        processes: 900,
        report: 86400
      }
    });
  });

  it('refuses to present a consumer device without its monitor settings', async () => {
    await expect(
      consumerConsumerDevicePresenter
        .present({ consumerDevice, telemetry: { enabled: false, tokenId: null } }, context)
        .run()
    ).rejects.toThrow('monitor settings');
  });
});

describe('consumer device detections', () => {
  it('lists the AI tools found on the device by name', async () => {
    let seenAt = new Date();
    let device = await v1ConsumerDevicePresenter
      .present(
        {
          consumerDevice: {
            ...consumerDevice,
            detectionReportedAt: seenAt,
            detections: [
              {
                id: 'codd_1',
                toolKey: 'ollama',
                state: 'running',
                confidence: 'high',
                signalKinds: ['app', 'process'],
                version: '0.12.0',
                firstSeenAt: seenAt,
                lastSeenAt: seenAt,
                goneAt: null
              }
            ]
          }
        },
        { ...context, apiVersion: 'mt_2026_01_01_magnetar' }
      )
      .run();

    expect(device.detections).toEqual([
      {
        object: 'consumer.device.detection',
        id: 'codd_1',
        tool_key: 'ollama',
        tool_name: 'Ollama',
        state: 'running',
        confidence: 'high',
        signal_kinds: ['app', 'process'],
        version: '0.12.0',
        stale: false,
        first_seen_at: seenAt,
        last_seen_at: seenAt
      }
    ]);
  });
});
