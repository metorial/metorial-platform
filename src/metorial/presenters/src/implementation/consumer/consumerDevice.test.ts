import { describe, expect, it, vi } from 'vitest';
import { getDetectionCatalog } from '@metorial/model-catalog/detection';

vi.mock(
  '@metorial/module-consumer-core',
  async () => await import('@metorial/module-consumer-core/src/lib/aiToolDetection')
);

vi.mock('@metorial/module-agent-tracking-query', () => ({ agentActiveWindowDays: 30 }));

import { consumerConsumerDevicePresenter, v1ConsumerDevicePresenter } from './consumerDevice';

let context = {
  apiVersion: 'mt_2026_04_01_consumer',
  accessType: 'user_auth_token'
} as const;

let deviceMonitor = (d: { aiToolDetection: boolean }) => ({
  aiToolDetection: d.aiToolDetection,
  catalogVersion: getDetectionCatalog().version,
  intervals: {
    config_dirs: 300,
    apps: 3600,
    binaries: 3600,
    ide_extensions: 3600,
    processes: 900,
    report: 86400
  }
});

let monitor = deviceMonitor({ aiToolDetection: false });

let install = { connectionMode: 'local_proxy' as const };

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

let telemetryOff = {
  enabled: false,
  tokenId: null,
  directExport: false,
  toolDetails: false,
  sessionContext: false,
  sessionTitles: false,
  historyImport: false
};

let telemetryOn = {
  enabled: true,
  tokenId: 'git_1',
  directExport: true,
  toolDetails: true,
  sessionContext: true,
  sessionTitles: false,
  historyImport: true
};

describe('consumer device telemetry', () => {
  it('shows the telemetry state to the consumer', async () => {
    let device = await consumerConsumerDevicePresenter
      .present(
        {
          consumerDevice,
          telemetry: telemetryOn,
          monitor,
          install
        },
        context
      )
      .run();

    expect(device).toMatchObject({
      object: 'consumer.device',
      id: 'codv_1',
      telemetry: {
        enabled: true,
        token_id: 'git_1',
        direct_export: true,
        tool_details: true,
        session_context: true,
        session_titles: false,
        history_import: true
      }
    });
  });

  it('offers direct export only while telemetry is collected', async () => {
    for (let telemetry of [telemetryOn, telemetryOff]) {
      let device = await consumerConsumerDevicePresenter
        .present({ consumerDevice, telemetry, monitor, install }, context)
        .run();

      expect(device.telemetry.direct_export).toBe(telemetry.enabled);
    }
  });

  it('keeps the telemetry state out of the public and dashboard device', async () => {
    let device = await v1ConsumerDevicePresenter
      .present(
        {
          consumerDevice,
          telemetry: telemetryOn,
          monitor
        },
        { ...context, apiVersion: 'mt_2026_01_01_magnetar' }
      )
      .run();

    expect(device).not.toHaveProperty('telemetry');
    expect(device).not.toHaveProperty('monitor');
    expect(device).not.toHaveProperty('install');
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
          telemetry: telemetryOff,
          monitor: deviceMonitor({ aiToolDetection: true }),
          install
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
        .present({ consumerDevice, telemetry: telemetryOff }, context)
        .run()
    ).rejects.toThrow('monitor settings');
  });
});

describe('consumer device install settings', () => {
  it('tells the device how to connect AI tools to integrations', async () => {
    for (let connectionMode of ['local_proxy', 'direct'] as const) {
      let device = await consumerConsumerDevicePresenter
        .present(
          {
            consumerDevice,
            telemetry: telemetryOff,
            monitor,
            install: { connectionMode }
          },
          context
        )
        .run();

      expect(device.install).toEqual({ connection_mode: connectionMode });
    }
  });

  it('refuses to present a consumer device without its install settings', async () => {
    await expect(
      consumerConsumerDevicePresenter
        .present(
          {
            consumerDevice,
            telemetry: telemetryOff,
            monitor
          },
          context
        )
        .run()
    ).rejects.toThrow('install settings');
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
