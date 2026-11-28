import { v } from '@lowerdeck/validation';
import {
  ConsumerDeviceDetectionConfidence,
  ConsumerDeviceDetectionSignalKind,
  ConsumerDeviceDetectionState,
  type ConsumerDevice,
  type ConsumerDeviceDetection
} from '@metorial/db';
import {
  agentSurfaces,
  findDetectionTool,
  getDetectionCatalog
} from '@metorial/model-catalog/detection';
import {
  detectionStaleAfterDays,
  isDetectionReportStale
} from '@metorial/module-consumer-core';
import { Presenter } from '@metorial/presenter';
import {
  consumerDeviceDetectionCatalogType,
  consumerDeviceDetectionReportType
} from '../../types';

export let aiToolSurfacesSchema = v.array(v.enumOf([...agentSurfaces]), {
  name: 'surfaces',
  description:
    'Where the tool runs: `cli`, `ide`, `ide-extension`, `desktop`, `web` or `cloud`.'
});

export let presentDeviceDetection = (
  detection: ConsumerDeviceDetection,
  consumerDevice: Pick<ConsumerDevice, 'detectionReportedAt'>
) => ({
  object: 'consumer.device.detection' as const,
  id: detection.id,
  tool_key: detection.toolKey,
  tool_name: findDetectionTool(detection.toolKey)?.name ?? detection.toolKey,
  state: detection.state,
  confidence: detection.confidence,
  signal_kinds: detection.signalKinds,
  version: detection.version,
  stale: isDetectionReportStale(consumerDevice.detectionReportedAt),
  first_seen_at: detection.firstSeenAt,
  last_seen_at: detection.lastSeenAt
});

export let detectionFieldSchemas = {
  tool_key: v.string({
    name: 'tool_key',
    description: 'Catalog key of the AI tool.',
    examples: ['claude-code', 'ollama']
  }),
  tool_name: v.string({
    name: 'tool_name',
    description: 'Name of the AI tool in the detection catalog.',
    examples: ['Claude Code', 'Ollama']
  }),
  state: v.enumOf(Object.values(ConsumerDeviceDetectionState), {
    name: 'state',
    description:
      '`running` when a process of the tool was found running, otherwise `installed`.'
  }),
  confidence: v.enumOf(Object.values(ConsumerDeviceDetectionConfidence), {
    name: 'confidence',
    description:
      'How sure the device is that the tool is present: `high` when two or more kinds of signal matched, `low` when only a process or only an executable on the `PATH` matched, otherwise `medium`.'
  }),
  signal_kinds: v.array(v.enumOf(Object.values(ConsumerDeviceDetectionSignalKind)), {
    name: 'signal_kinds',
    description:
      'Kinds of signal that matched: `config_dir`, `app`, `path` (an executable on the `PATH`), `ide_extension` or `process`.'
  }),
  version: v.nullable(
    v.string({
      name: 'version',
      description:
        'Version of the tool as installed. `null` when the device could not read it.',
      examples: ['1.7.4']
    })
  ),
  stale: v.boolean({
    name: 'stale',
    description: `\`true\` when the device has sent no detection report for ${detectionStaleAfterDays} days. Stale detections are not counted on AI tools.`
  }),
  first_seen_at: v.date({
    name: 'first_seen_at',
    description: 'When a report from this device first listed the tool.'
  }),
  last_seen_at: v.date({
    name: 'last_seen_at',
    description: 'When the latest report that listed the tool was generated on the device.'
  })
};

export let deviceDetectionSchema = v.object({
  object: v.literal('consumer.device.detection', {
    description: 'String representing the object’s type.'
  }),
  id: v.string({ name: 'id', description: 'Unique ID.', examples: ['codd_0mfz6q2xbb'] }),
  ...detectionFieldSchemas
});

export let v1ConsumerDeviceDetectionReportPresenter = Presenter.create(
  consumerDeviceDetectionReportType
)
  .presenter(async ({ consumerDevice, applied }) => ({
    object: 'consumer.device.detection_report' as const,
    consumer_device_id: consumerDevice.id,
    applied,
    seq: consumerDevice.detectionSeq,
    catalog_version: getDetectionCatalog().version,
    detections: consumerDevice.detections.map(detection =>
      presentDeviceDetection(detection, consumerDevice)
    )
  }))
  .schema(
    v.object({
      object: v.literal('consumer.device.detection_report', {
        description: 'String representing the object’s type.'
      }),
      consumer_device_id: v.string({
        name: 'consumer_device_id',
        description: 'Device the report was sent from.'
      }),
      applied: v.boolean({
        name: 'applied',
        description:
          '`false` when the report was ignored because its `seq` was not higher than the last accepted one. Sending the same report again is safe.'
      }),
      seq: v.nullable(
        v.number({
          name: 'seq',
          description:
            'Highest sequence number accepted for this device. A device whose local counter is lower continues from this value.'
        })
      ),
      catalog_version: v.string({
        name: 'catalog_version',
        description:
          'Current version of the detection catalog. When it differs from the version the device holds, the device fetches the catalog again.'
      }),
      detections: v.array(deviceDetectionSchema, {
        name: 'detections',
        description: 'AI tools found on the device by the latest accepted report.'
      })
    })
  )
  .build();

let signaturesSchema = (platform: string) =>
  v.object(
    {
      config_dirs: v.array(v.string(), {
        name: 'config_dirs',
        description:
          'Folders the tool creates. Each path uses `/` and starts with `~` (the home folder), `%APPDATA%`, `%LOCALAPPDATA%` or `%PROGRAMFILES%`.',
        examples: [['~/.claude']]
      }),
      apps: v.array(v.string(), {
        name: 'apps',
        description:
          'Installed apps: bundle names looked up in `/Applications` and `~/Applications` on macOS, install folders on Windows.',
        examples: [['Cursor.app']]
      }),
      binaries: v.array(v.string(), {
        name: 'binaries',
        description: 'Executable names looked up on the `PATH`.',
        examples: [['codex']]
      }),
      process_names: v.array(v.string(), {
        name: 'process_names',
        description:
          'Executable names of running processes, matched ignoring case. No two tools share one.',
        examples: [['Cursor']]
      })
    },
    { name: platform, description: `Signals checked on ${platform}.` }
  );

export let v1ConsumerDeviceDetectionCatalogPresenter = Presenter.create(
  consumerDeviceDetectionCatalogType
)
  .presenter(async ({ catalog }) => ({
    object: 'consumer.device.detection_catalog' as const,
    schema: catalog.schema,
    version: catalog.version,
    tools: catalog.tools
  }))
  .schema(
    v.object({
      object: v.literal('consumer.device.detection_catalog', {
        description: 'String representing the object’s type.'
      }),
      schema: v.number({
        name: 'schema',
        description:
          'Format version of the catalog. It only changes when fields are added, renamed or removed.'
      }),
      version: v.string({
        name: 'version',
        description:
          'Content hash of the catalog. It changes whenever a tool or signal changes, and devices see it in `monitor.catalog_version` at check-in.',
        examples: ['5b8e7bd62ccb7f44']
      }),
      tools: v.array(
        v.object({
          key: v.string({
            name: 'key',
            description: 'Catalog key of the AI tool, the `tool_key` reports use.',
            examples: ['cursor']
          }),
          name: v.string({ name: 'name', description: 'Display name.' }),
          description: v.string({
            name: 'description',
            description: 'Free-text description.'
          }),
          maker: v.object(
            {
              id: v.string({ name: 'id', description: 'Unique ID.', examples: ['anthropic'] }),
              name: v.string({ name: 'name', description: 'Display name.' })
            },
            { name: 'maker', description: 'Company or project that makes the tool.' }
          ),
          website: v.nullable(v.string({ name: 'website', description: 'Product website.' })),
          surfaces: aiToolSurfacesSchema,
          ide_extension_ids: v.array(v.string(), {
            name: 'ide_extension_ids',
            description:
              'Editor extension IDs (`publisher.name`) matched against the extension folders of VS Code and compatible editors.',
            examples: [['anthropic.claude-code']]
          }),
          platforms: v.object(
            {
              macos: signaturesSchema('macos'),
              windows: signaturesSchema('windows'),
              linux: signaturesSchema('linux')
            },
            { name: 'platforms', description: 'Signals per operating system.' }
          )
        }),
        {
          name: 'tools',
          description:
            'AI tools the device looks for, sorted by key. A tool matched only by a process or only by an executable on the `PATH` is reported with `low` confidence.'
        }
      )
    })
  )
  .build();
