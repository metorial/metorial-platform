import { v } from '@lowerdeck/validation';
import { ConsumerDeviceStatus } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { consumerDeviceType } from '../../types';
import { deviceDetectionSchema, presentDeviceDetection } from './consumerDeviceDetection';

export let v1ConsumerDevicePresenter = Presenter.create(consumerDeviceType)
  .presenter(async ({ consumerDevice }) => ({
    object: 'consumer.device' as const,
    id: consumerDevice.id,
    status: consumerDevice.status,

    consumer_profile_id: consumerDevice.consumerProfile.id,

    name: consumerDevice.name,
    os: consumerDevice.os,
    arch: consumerDevice.arch,
    app_version: consumerDevice.appVersion,

    clients: consumerDevice.clients.map(client => ({
      object: 'consumer.device.client' as const,
      key: client.mcpClientType.key,
      name: client.name,
      detected: client.detected,
      installable: client.installable,
      supports_skills: client.supportsSkills,
      enabled: client.enabled,
      excluded_magic_mcp_server_ids: client.excludedMagicMcpServers.map(
        exclusion => exclusion.magicMcpServer.id
      ),
      excluded_skill_ids: client.excludedSkills.map(exclusion => exclusion.skill.id)
    })),

    detections: consumerDevice.detections.map(detection =>
      presentDeviceDetection(detection, consumerDevice)
    ),

    last_seen_at: consumerDevice.lastSeenAt,
    revoked_at: consumerDevice.revokedAt,
    created_at: consumerDevice.createdAt,
    updated_at: consumerDevice.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer.device', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({ name: 'id', description: 'Unique ID.' }),
      status: v.enumOf(Object.values(ConsumerDeviceStatus), {
        name: 'status',
        description:
          'Whether the device is signed in (`active`), was signed out from the app (`signed_out`), or was revoked from the portal or dashboard (`revoked`).'
      }),
      consumer_profile_id: v.string({
        name: 'consumer_profile_id',
        description: 'The ID of the consumer profile that enrolled the device.'
      }),
      name: v.string({
        name: 'name',
        description: 'The computer name reported by the device.',
        examples: ["Ada's MacBook Pro"]
      }),
      os: v.string({
        name: 'os',
        description: 'The operating system reported by the device.',
        examples: ['macos', 'windows', 'linux']
      }),
      arch: v.string({
        name: 'arch',
        description: 'The CPU architecture reported by the device.',
        examples: ['aarch64', 'x86_64']
      }),
      app_version: v.string({
        name: 'app_version',
        description: 'The Metorial Desktop version running on the device.',
        examples: ['0.2.0']
      }),
      clients: v.array(
        v.object({
          object: v.literal('consumer.device.client', {
            description: 'String representing the object’s type.'
          }),
          key: v.string({
            name: 'key',
            description: 'Which AI tool this entry is for.',
            examples: ['claude-code', 'cursor']
          }),
          name: v.string({
            name: 'name',
            description: 'The AI tool name.',
            examples: ['Claude Code', 'Cursor']
          }),
          detected: v.boolean({
            name: 'detected',
            description: 'Whether the device found this AI tool at its last check-in.'
          }),
          installable: v.boolean({
            name: 'installable',
            description: 'Whether Metorial Desktop can configure this AI tool on the device.'
          }),
          supports_skills: v.boolean({
            name: 'supports_skills',
            description: 'Whether Metorial Desktop can link skills into this AI tool.'
          }),
          enabled: v.boolean({
            name: 'enabled',
            description:
              'Whether Metorial Desktop keeps this AI tool configured. Detected tools are enabled until turned off.'
          }),
          excluded_magic_mcp_server_ids: v.array(v.string(), {
            name: 'excluded_magic_mcp_server_ids',
            description:
              'Magic MCP servers not installed into this AI tool. Servers not listed here are installed, including ones granted later.'
          }),
          excluded_skill_ids: v.array(v.string(), {
            name: 'excluded_skill_ids',
            description:
              'Skills not linked into this AI tool. Skills not listed here are linked, including ones granted later.'
          })
        }),
        {
          name: 'clients',
          description: 'The AI tools the device reported, with what each one receives.'
        }
      ),
      detections: v.array(deviceDetectionSchema, {
        name: 'detections',
        description:
          'AI tools found on the device by its latest detection report. Always empty while AI tool detection is off for the instance or not available to the organization; turning it off deletes what devices reported.'
      }),
      last_seen_at: v.date({
        name: 'last_seen_at',
        description: 'When the device last checked in.'
      }),
      revoked_at: v.nullable(
        v.date({
          name: 'revoked_at',
          description: 'When the device was revoked. Revoked devices stay listable.'
        })
      ),
      created_at: v.date({ name: 'created_at', description: 'Creation time.' }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Last update time.'
      })
    })
  )
  .build();

export let consumerConsumerDevicePresenter = Presenter.create(consumerDeviceType)
  .presenter(async ({ consumerDevice, telemetry, monitor }, opts) => {
    if (!telemetry) {
      throw new Error(
        'The consumer device presenter needs the telemetry state of the device.'
      );
    }
    if (!monitor) {
      throw new Error(
        'The consumer device presenter needs the monitor settings of the device.'
      );
    }

    let inner = await v1ConsumerDevicePresenter.present({ consumerDevice }, opts).run();

    return {
      ...inner,
      telemetry: {
        enabled: telemetry.enabled,
        token_id: telemetry.tokenId
      },
      monitor: {
        ai_tool_detection: monitor.aiToolDetection,
        catalog_version: monitor.catalogVersion,
        intervals: monitor.intervals
      }
    };
  })
  .schema(
    v.object({
      ...v1ConsumerDevicePresenter.schema.properties,
      telemetry: v.object(
        {
          enabled: v.boolean({
            name: 'enabled',
            description:
              'Whether agent telemetry is collected for this device now. Metorial Desktop sends telemetry only while this is true.'
          }),
          token_id: v.nullable(
            v.string({
              name: 'token_id',
              description:
                'The ID of the active telemetry token of the device, the `token_id` the telemetry token endpoint returned. Null when the device has no active token or telemetry is not collected. When it differs from the token the device holds, that token no longer works.'
            })
          )
        },
        {
          name: 'telemetry',
          description: 'Whether the device sends agent telemetry, and with which token.'
        }
      ),
      monitor: v.object(
        {
          ai_tool_detection: v.boolean({
            name: 'ai_tool_detection',
            description:
              'Whether the device looks for AI tools and reports them. When `false`, Metorial Desktop stops collecting and discards unsent reports.'
          }),
          catalog_version: v.string({
            name: 'catalog_version',
            description:
              'Current version of the detection catalog. The device fetches the catalog again when its copy has another version.',
            examples: ['5b8e7bd62ccb7f44']
          }),
          intervals: v.object(
            {
              config_dirs: v.number({
                name: 'config_dirs',
                description: 'How often to check config folders, in seconds.'
              }),
              apps: v.number({
                name: 'apps',
                description: 'How often to check installed apps, in seconds.'
              }),
              binaries: v.number({
                name: 'binaries',
                description: 'How often to check executables on the `PATH`, in seconds.'
              }),
              ide_extensions: v.number({
                name: 'ide_extensions',
                description: 'How often to check editor extensions, in seconds.'
              }),
              processes: v.number({
                name: 'processes',
                description: 'How often to check running processes, in seconds.'
              }),
              report: v.number({
                name: 'report',
                description:
                  'Longest time between two reports, in seconds. The device also reports as soon as what it finds changes.'
              })
            },
            {
              name: 'intervals',
              description: 'How often the device collects each kind of signal.'
            }
          )
        },
        {
          name: 'monitor',
          description: 'What the device monitors, as set by the organization.'
        }
      )
    }) as any
  )
  .build();
