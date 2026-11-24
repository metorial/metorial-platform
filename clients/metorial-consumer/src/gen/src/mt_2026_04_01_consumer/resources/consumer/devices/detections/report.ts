import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ConsumerDevicesDetectionsReportOutput = {
  object: 'consumer.device.detection_report';
  consumerDeviceId: string;
  applied: boolean;
  seq: number | null;
  catalogVersion: string;
  detections: {
    object: 'consumer.device.detection';
    id: string;
    toolKey: string;
    toolName: string;
    state: 'installed' | 'running';
    confidence: 'high' | 'medium' | 'low';
    signalKinds: ('config_dir' | 'app' | 'path' | 'ide_extension' | 'process')[];
    version: string | null;
    stale: boolean;
    firstSeenAt: Date;
    lastSeenAt: Date;
  }[];
};

export let mapConsumerDevicesDetectionsReportOutput =
  /* @__PURE__ */ mapObject<ConsumerDevicesDetectionsReportOutput>(
    [
      'consumer_device_id',
      'catalog_version',
      [
        'detections',
        0,
        [2, [1, ['tool_key', 'tool_name', 'signal_kinds', 'first_seen_at', 'last_seen_at']]]
      ]
    ],
    1
  );

export type ConsumerDevicesDetectionsReportBody = {
  seq: number;
  generatedAt: Date;
  catalogVersion?: string | undefined;
  findings: {
    toolKey: string;
    state: 'installed' | 'running';
    confidence: 'high' | 'medium' | 'low';
    signalKinds: ('config_dir' | 'app' | 'path' | 'ide_extension' | 'process')[];
    version?: string | undefined;
  }[];
};

export let mapConsumerDevicesDetectionsReportBody =
  /* @__PURE__ */ mapObject<ConsumerDevicesDetectionsReportBody>(
    [
      'generated_at',
      'catalog_version',
      ['findings', 0, [2, [1, ['tool_key', 'signal_kinds']]]]
    ],
    1
  );
