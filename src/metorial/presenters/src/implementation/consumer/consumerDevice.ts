import { v } from '@lowerdeck/validation';
import { ConsumerDeviceStatus } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { consumerDeviceType } from '../../types';

export let v1ConsumerDevicePresenter = Presenter.create(consumerDeviceType)
  .presenter(async ({ consumerDevice }) => {
    let settings = new Map(
      consumerDevice.clientSettings.map(setting => [setting.clientKey, setting])
    );

    return {
      object: 'consumer.device' as const,
      id: consumerDevice.id,
      status: consumerDevice.status,

      consumer_profile_id: consumerDevice.consumerProfile.id,

      name: consumerDevice.name,
      os: consumerDevice.os,
      arch: consumerDevice.arch,
      app_version: consumerDevice.appVersion,

      clients: consumerDevice.reportedClients.map(client => {
        let setting = settings.get(client.key);

        return {
          object: 'consumer.device.client' as const,
          key: client.key,
          name: client.name,
          detected: client.detected,
          installable: client.installable,
          supports_skills: client.supportsSkills,
          enabled: setting?.enabled ?? true,
          excluded_magic_mcp_server_ids: setting?.excludedMagicMcpServerIds ?? [],
          excluded_skill_ids: setting?.excludedSkillIds ?? []
        };
      }),

      last_seen_at: consumerDevice.lastSeenAt,
      revoked_at: consumerDevice.revokedAt,
      created_at: consumerDevice.createdAt,
      updated_at: consumerDevice.updatedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('consumer.device'),
      id: v.string({ name: 'id', description: 'The device ID.' }),
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
          object: v.literal('consumer.device.client'),
          key: v.string({
            name: 'key',
            description: 'The AI tool identifier.',
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
      last_seen_at: v.date({
        name: 'last_seen_at',
        description: 'When the device last checked in.'
      }),
      revoked_at: v.nullable(
        v.date({ name: 'revoked_at', description: 'When the device was revoked.' })
      ),
      created_at: v.date({ name: 'created_at', description: 'When the device was enrolled.' }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'When the device was last updated.'
      })
    })
  )
  .build();
