import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { agentTrackingTokenService } from '@metorial/module-agent-tracking-access';
import {
  ConsumerDeviceDetectionConfidence,
  ConsumerDeviceDetectionSignalKind,
  ConsumerDeviceDetectionState,
  type Instance,
  type Organization,
  type Project
} from '@metorial/db';
import { getDetectionCatalog } from '@metorial/model-catalog/detection';
import {
  consumerDeviceDetectionService,
  consumerDeviceService,
  consumerDeviceStatuses,
  maxDetectionFindings
} from '@metorial/module-consumer-core';
import { flagService } from '@metorial/module-flags';
import {
  consumerDeviceDetectionCatalogPresenter,
  consumerDeviceDetectionReportPresenter,
  consumerDevicePresenter,
  consumerDeviceTelemetryTokenPresenter
} from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import {
  getDeviceMonitor,
  requireDetectionCatalog,
  requireDetectionReporting,
  withVisibleDetections
} from '../../lib/aiToolDetection';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { requireParam } from '../../lib/requireParam';
import { getSignedInOAuthToken } from '../../lib/signedInOAuthToken';
import { checkAccess } from '../../middleware/checkAccess';
import { requireDeviceTelemetry } from './deviceTelemetry';
import { consumerGroup, consumerPath } from '../../middleware/consumerGroup';

let maxReportedClients = 32;
let maxExcludedIds = 500;
let maxIdLength = 128;
let maxInstallTokenIds = 200;

let maxSeq = 2_147_483_647;

let clientKeyPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
let versionPattern = /^[0-9A-Za-z.+_-]{1,64}$/;

let resourceId = v.string({ modifiers: [v.maxLength(maxIdLength)] });

// Not found rather than forbidden: Metorial Desktop reads a 404 on check-in as
// "this server has no devices" and keeps its local tool choices.
let devicesGroup = consumerGroup.use(async ctx => {
  let enabled = await flagService.isFlagEnabledForScope({
    organization: ctx.organization,
    project: ctx.project,
    flag: 'devices-enabled'
  });
  if (!enabled) throw new ServiceError(notFoundError('consumer.device'));
});

let consumerDeviceGroup = devicesGroup.use(async ctx => {
  let consumerDevice = await consumerDeviceService.getDeviceById({
    instance: ctx.instance,
    consumerProfile: ctx.consumerProfile,
    consumerDeviceId: requireParam(ctx.params, 'consumerDeviceId')
  });

  return { consumerDevice };
});

let consumerDeviceTelemetryGroup = consumerDeviceGroup.use(requireDeviceTelemetry);

let consumerDeviceDetectionGroup = consumerDeviceGroup.use(requireDetectionReporting);

let detectionCatalogGroup = devicesGroup.use(requireDetectionCatalog);

type PresentableDevice = Parameters<
  typeof consumerDevicePresenter.present
>[0]['consumerDevice'];

type DeviceContext = { organization: Organization; project: Project; instance: Instance };

let presentDevices = async (ctx: DeviceContext, consumerDevices: PresentableDevice[]) => {
  let [telemetry, monitor] = await Promise.all([
    agentTrackingTokenService.listDeviceTelemetry({
      organization: ctx.organization,
      project: ctx.project,
      consumerDevices
    }),
    getDeviceMonitor(ctx)
  ]);

  return consumerDevices.map(consumerDevice =>
    consumerDevicePresenter.present({
      consumerDevice: withVisibleDetections(consumerDevice, monitor.aiToolDetection),
      telemetry: telemetry.get(consumerDevice.oid),
      monitor
    })
  );
};

let presentDevice = async (ctx: DeviceContext, consumerDevice: PresentableDevice) =>
  (await presentDevices(ctx, [consumerDevice]))[0]!;

export let consumerDeviceController = Controller.create(
  {
    name: 'Consumer Devices',
    description:
      'Enroll Metorial Desktop devices and choose which integrations and skills each AI tool on them receives.',
    hideInDocs: true
  },
  {
    checkIn: devicesGroup
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

        return await presentDevice(ctx, consumerDevice);
      }),

    list: devicesGroup
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
        let items = await presentDevices(ctx, list.items);

        return Paginator.present({ ...list, items }, device => device);
      }),

    get: consumerDeviceGroup
      .get(consumerPath('devices/:consumerDeviceId', 'devices.get'), {
        name: 'Get device',
        description: 'Retrieves a device enrolled by the authenticated consumer profile.'
      })
      .use(checkAccess({ possibleScopes: ['consumer#instance.device:read'] }))
      .output(consumerDevicePresenter)
      .do(async ctx => await presentDevice(ctx, ctx.consumerDevice)),

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

        return await presentDevice(ctx, consumerDevice);
      }),

    signOut: devicesGroup
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

        return await presentDevice(ctx, consumerDevice);
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

        return await presentDevice(ctx, consumerDevice);
      }),

    getDetectionCatalog: detectionCatalogGroup
      .get(consumerPath('device-detection-catalog', 'deviceDetectionCatalog.get'), {
        name: 'Get device detection catalog',
        description:
          'Returns the signals Metorial Desktop matches to find AI tools on a device. Fetch it again when `monitor.catalog_version` on the device changes. Returns 404 when AI tool detection is not available to the organization.'
      })
      .use(checkAccess({ possibleScopes: ['consumer#instance.device:read'] }))
      .output(consumerDeviceDetectionCatalogPresenter)
      .do(async () =>
        consumerDeviceDetectionCatalogPresenter.present({ catalog: getDetectionCatalog() })
      ),

    reportDetections: consumerDeviceDetectionGroup
      .post(
        consumerPath('devices/:consumerDeviceId/detections', 'devices.detections.report'),
        {
          name: 'Report device detections',
          description:
            'Replaces what the device reported before with a full snapshot of the AI tools it found. Tools left out are marked gone. A report whose `seq` is not higher than the last accepted one changes nothing. Only the sign-in the device enrolled with can report; others get 412. Returns 403 `detection_disabled` when AI tool detection is off; the device then stops collecting.'
        }
      )
      .use(checkAccess({ possibleScopes: ['consumer#instance.device:write'] }))
      .body(
        'default',
        v.object({
          seq: v.number({
            name: 'seq',
            description:
              'Sequence number of the report, increasing with every report the device sends. From 1 to 2147483647.',
            modifiers: [v.integer(), v.minValue(1), v.maxValue(maxSeq)]
          }),
          generated_at: v.date({
            name: 'generated_at',
            description:
              'When the device collected the snapshot. Times in the future count as the time the report arrived, and times more than 7 days back as 7 days back.'
          }),
          catalog_version: v.optional(
            v.string({
              name: 'catalog_version',
              description:
                'Version of the detection catalog the device matched against. Informational only; the report is matched against the current catalog.',
              examples: ['5b8e7bd62ccb7f44'],
              modifiers: [v.maxLength(64)]
            })
          ),
          findings: v.array(
            v.object({
              tool_key: v.string({
                name: 'tool_key',
                description:
                  'Catalog key of the AI tool found. Keys the current catalog does not list are ignored.',
                examples: ['claude-code'],
                modifiers: [v.regex(clientKeyPattern)]
              }),
              state: v.enumOf(Object.values(ConsumerDeviceDetectionState), {
                name: 'state',
                description:
                  '`running` when a process of the tool was found running, otherwise `installed`.'
              }),
              confidence: v.enumOf(Object.values(ConsumerDeviceDetectionConfidence), {
                name: 'confidence',
                description: 'How sure the device is that the tool is present.'
              }),
              signal_kinds: v.array(
                v.enumOf(Object.values(ConsumerDeviceDetectionSignalKind)),
                {
                  name: 'signal_kinds',
                  description: 'Which kinds of signal matched.',
                  modifiers: [v.minLength(1), v.maxLength(8)]
                }
              ),
              version: v.optional(
                v.string({
                  name: 'version',
                  description:
                    'Installed version of the tool, when the device could read it. Letters, digits, `.`, `+`, `_` and `-`, up to 64 characters.',
                  examples: ['1.7.4'],
                  modifiers: [v.regex(versionPattern)]
                })
              )
            }),
            {
              name: 'findings',
              description: `Every AI tool found on the device, at most ${maxDetectionFindings}. An empty list marks every tool gone.`,
              modifiers: [v.maxLength(maxDetectionFindings)]
            }
          )
        })
      )
      .output(consumerDeviceDetectionReportPresenter)
      .do(async ctx => {
        let report = await consumerDeviceDetectionService.reportDetections({
          consumerDevice: ctx.consumerDevice,
          oauthToken: getSignedInOAuthToken(ctx),
          auditScope: ctx.auditScope,
          input: {
            seq: ctx.body.seq,
            generatedAt: ctx.body.generated_at,
            findings: ctx.body.findings.map(finding => ({
              toolKey: finding.tool_key,
              state: finding.state,
              confidence: finding.confidence,
              signalKinds: finding.signal_kinds,
              version: finding.version ?? null
            }))
          }
        });

        return consumerDeviceDetectionReportPresenter.present(report);
      }),

    issueTelemetryToken: consumerDeviceTelemetryGroup
      .post(
        consumerPath(
          'devices/:consumerDeviceId/telemetry-token',
          'devices.telemetryToken.issue'
        ),
        {
          name: 'Issue device telemetry token',
          description:
            'Issues the ingest token the device sends agent telemetry with, bound to the consumer that enrolled this device. Every call rotates: the new token replaces the previous tokens of the device, which are revoked. The secret is only returned here. Returns 404 when agent telemetry is not collected for this organization, and 412 when the device is no longer signed in.'
        }
      )
      .use(checkAccess({ possibleScopes: ['consumer#instance.device:write'] }))
      .output(consumerDeviceTelemetryTokenPresenter)
      .do(async ctx => {
        let issued = await agentTrackingTokenService.issueDeviceToken({
          consumerDevice: ctx.consumerDevice,
          auditScope: ctx.auditScope
        });

        return consumerDeviceTelemetryTokenPresenter.present({
          consumerDevice: ctx.consumerDevice,
          ...issued
        });
      })
  }
);
