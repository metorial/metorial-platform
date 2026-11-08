import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { consumerDeviceService, consumerDeviceStatuses } from '@metorial/module-consumer-core';
import { consumerDevicePresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { requireParam } from '../../lib/requireParam';
import { getSignedInOAuthToken } from '../../lib/signedInOAuthToken';
import { checkAccess } from '../../middleware/checkAccess';
import { consumerGroup, consumerPath } from '../../middleware/consumerGroup';

let maxReportedClients = 32;
let maxExcludedIds = 500;
let maxIdLength = 128;
let maxInstallTokenIds = 200;

let clientKeyPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;

let resourceId = v.string({ modifiers: [v.maxLength(maxIdLength)] });

let consumerDeviceGroup = consumerGroup.use(async ctx => {
  let consumerDevice = await consumerDeviceService.getDeviceById({
    instance: ctx.instance,
    consumerProfile: ctx.consumerProfile,
    consumerDeviceId: requireParam(ctx.params, 'consumerDeviceId')
  });

  return { consumerDevice };
});

export let consumerDeviceController = Controller.create(
  {
    name: 'Consumer Devices',
    description:
      'Enroll Metorial Desktop devices and choose which integrations and skills each AI tool on them receives.',
    hideInDocs: true
  },
  {
    checkIn: consumerGroup
      .post(consumerPath('devices/check-in', 'devices.checkIn'), {
        name: 'Check in device',
        description:
          'Enrolls the signed-in Metorial Desktop device, or refreshes what it reports, and returns what each AI tool on it should receive.'
      })
      .use(checkAccess({ possibleScopes: ['consumer#instance.device:write'] }))
      .body(
        'default',
        v.object({
          installation_id: v.string({
            name: 'installation_id',
            description: 'A random identifier the app generates once per installation.',
            modifiers: [v.minLength(16), v.maxLength(128)]
          }),
          name: v.string({
            name: 'name',
            description: 'The computer name.',
            examples: ["Ada's MacBook Pro"],
            modifiers: [v.minLength(1), v.maxLength(200)]
          }),
          os: v.string({
            name: 'os',
            description: 'The operating system.',
            examples: ['macos', 'windows', 'linux'],
            modifiers: [v.maxLength(32)]
          }),
          arch: v.string({
            name: 'arch',
            description: 'The CPU architecture.',
            examples: ['aarch64', 'x86_64'],
            modifiers: [v.maxLength(32)]
          }),
          app_version: v.string({
            name: 'app_version',
            description: 'The Metorial Desktop version.',
            examples: ['0.2.0'],
            modifiers: [v.maxLength(64)]
          }),
          clients: v.array(
            v.object({
              key: v.string({
                name: 'key',
                description: 'The AI tool identifier: lowercase letters, digits and dashes.',
                examples: ['cursor'],
                modifiers: [v.regex(clientKeyPattern)]
              }),
              name: v.string({
                name: 'name',
                description: 'The AI tool name.',
                examples: ['Cursor'],
                modifiers: [v.maxLength(100)]
              }),
              detected: v.boolean({
                name: 'detected',
                description: 'Whether the AI tool was found on the device.'
              }),
              installable: v.boolean({
                name: 'installable',
                description: 'Whether Metorial Desktop can configure the AI tool.'
              }),
              supports_skills: v.boolean({
                name: 'supports_skills',
                description: 'Whether Metorial Desktop can link skills into the AI tool.'
              })
            }),
            {
              name: 'clients',
              description: 'Every AI tool Metorial Desktop knows about, found or not.',
              modifiers: [v.maxLength(maxReportedClients)]
            }
          ),
          magic_mcp_token_ids: v.optional(
            v.array(resourceId, {
              name: 'magic_mcp_token_ids',
              description:
                'Magic MCP tokens the app installed on this device. Tokens of the same consumer profile that belong to no device yet are linked to it, so revoking the device deletes them.',
              modifiers: [v.maxLength(maxInstallTokenIds)]
            })
          )
        })
      )
      .output(consumerDevicePresenter)
      .do(async ctx => {
        let consumerDevice = await consumerDeviceService.checkInDevice({
          instance: ctx.instance,
          consumerProfile: ctx.consumerProfile,
          oauthToken: getSignedInOAuthToken(ctx),
          auditScope: ctx.auditScope,
          input: {
            installationId: ctx.body.installation_id,
            name: ctx.body.name,
            os: ctx.body.os,
            arch: ctx.body.arch,
            appVersion: ctx.body.app_version,
            reportedClients: ctx.body.clients.map(client => ({
              key: client.key,
              name: client.name,
              detected: client.detected,
              installable: client.installable,
              supportsSkills: client.supports_skills
            })),
            magicMcpTokenIds: ctx.body.magic_mcp_token_ids
          }
        });

        return consumerDevicePresenter.present({ consumerDevice });
      }),

    list: consumerGroup
      .get(consumerPath('devices', 'devices.list'), {
        name: 'List devices',
        description: 'Returns the devices the authenticated consumer profile has enrolled.'
      })
      .use(checkAccess({ possibleScopes: ['consumer#instance.device:read'] }))
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union(
                [v.enumOf(consumerDeviceStatuses), v.array(v.enumOf(consumerDeviceStatuses))],
                {
                  name: 'status',
                  description: 'Only return devices with these statuses. Defaults to active.'
                }
              )
            )
          })
        )
      )
      .outputList(consumerDevicePresenter)
      .do(async ctx => {
        let paginator = await consumerDeviceService.listDevices({
          instance: ctx.instance,
          consumerProfileIds: [ctx.consumerProfile.id],
          statuses: normalizeArrayParam(ctx.query.status)
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, consumerDevice =>
          consumerDevicePresenter.present({ consumerDevice })
        );
      }),

    get: consumerDeviceGroup
      .get(consumerPath('devices/:consumerDeviceId', 'devices.get'), {
        name: 'Get device',
        description: 'Retrieves a device enrolled by the authenticated consumer profile.'
      })
      .use(checkAccess({ possibleScopes: ['consumer#instance.device:read'] }))
      .output(consumerDevicePresenter)
      .do(async ctx =>
        consumerDevicePresenter.present({ consumerDevice: ctx.consumerDevice })
      ),

    updateClient: consumerDeviceGroup
      .patch(
        consumerPath('devices/:consumerDeviceId/clients/:clientKey', 'devices.clients.update'),
        {
          name: 'Update device AI tool',
          description:
            'Turns an AI tool on the device on or off, and chooses which integrations and skills it does not receive. The device applies the change at its next sync.'
        }
      )
      .use(checkAccess({ possibleScopes: ['consumer#instance.device:write'] }))
      .body(
        'default',
        v.object({
          enabled: v.optional(
            v.boolean({
              name: 'enabled',
              description: 'Whether Metorial Desktop keeps this AI tool configured.'
            })
          ),
          excluded_magic_mcp_server_ids: v.optional(
            v.array(resourceId, {
              name: 'excluded_magic_mcp_server_ids',
              description:
                'Magic MCP servers not to install into this AI tool. Replaces the current list.',
              modifiers: [v.maxLength(maxExcludedIds)]
            })
          ),
          excluded_skill_ids: v.optional(
            v.array(resourceId, {
              name: 'excluded_skill_ids',
              description: 'Skills not to link into this AI tool. Replaces the current list.',
              modifiers: [v.maxLength(maxExcludedIds)]
            })
          )
        })
      )
      .output(consumerDevicePresenter)
      .do(async ctx => {
        let consumerDevice = await consumerDeviceService.updateClientSetting({
          consumerDevice: ctx.consumerDevice,
          clientKey: requireParam(ctx.params, 'clientKey'),
          auditScope: ctx.auditScope,
          input: {
            enabled: ctx.body.enabled,
            excludedMagicMcpServerIds: ctx.body.excluded_magic_mcp_server_ids,
            excludedSkillIds: ctx.body.excluded_skill_ids
          }
        });

        return consumerDevicePresenter.present({ consumerDevice });
      }),

    signOut: consumerGroup
      .post(consumerPath('devices/sign-out', 'devices.signOut'), {
        name: 'Sign out device',
        description:
          'Ends the device sign-in this request was made with and revokes its integration tokens. Other devices stay signed in.'
      })
      .use(checkAccess({ possibleScopes: ['consumer#instance.device:write'] }))
      .output(consumerDevicePresenter)
      .do(async ctx => {
        let consumerDevice = await consumerDeviceService.signOutDevice({
          consumerProfile: ctx.consumerProfile,
          oauthToken: getSignedInOAuthToken(ctx),
          auditScope: ctx.auditScope
        });

        return consumerDevicePresenter.present({ consumerDevice });
      }),

    revoke: consumerDeviceGroup
      .post(consumerPath('devices/:consumerDeviceId/revoke', 'devices.revoke'), {
        name: 'Revoke device',
        description:
          'Signs the device out and revokes its integration tokens. The app removes what it installed the next time it reaches Metorial.'
      })
      .use(checkAccess({ possibleScopes: ['consumer#instance.device:write'] }))
      .output(consumerDevicePresenter)
      .do(async ctx => {
        let consumerDevice = await consumerDeviceService.revokeDevice({
          consumerDevice: ctx.consumerDevice,
          auditScope: ctx.auditScope
        });

        return consumerDevicePresenter.present({ consumerDevice });
      })
  }
);
