import { notFoundError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import {
  addAfterTransactionHook,
  ConsumerDevice,
  ConsumerDeviceStatus,
  ConsumerProfile,
  db,
  ID,
  Instance,
  OAuthAuthorization,
  Prisma,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import {
  oauthAuthorizationService,
  type OAuthTokenWithAuthorization
} from '@metorial/module-machine-access';

// The AI tools Metorial Desktop reports. Client types are shared by every
// instance, so other keys are skipped rather than stored. A newer app that
// reports a tool not listed yet still checks in; that tool keeps its defaults.
let knownClientKeys = new Set(['claude-code', 'claude-desktop', 'codex', 'cursor', 'vscode']);

export let consumerDeviceStatuses = Object.values(ConsumerDeviceStatus);

export let consumerDeviceInclude = {
  clients: {
    where: { reported: true },
    orderBy: { mcpClientType: { key: 'asc' } },
    include: {
      mcpClientType: true,
      excludedMagicMcpServers: { orderBy: { oid: 'asc' }, include: { magicMcpServer: true } },
      excludedSkills: { orderBy: { oid: 'asc' }, include: { skill: true } }
    }
  },
  consumerProfile: true
} satisfies Prisma.ConsumerDeviceInclude;

export type ConsumerDeviceRecord = Prisma.ConsumerDeviceGetPayload<{
  include: typeof consumerDeviceInclude;
}>;

class ConsumerDeviceServiceImpl {
  async checkInDevice(d: {
    instance: Instance;
    consumerProfile: ConsumerProfile;
    oauthToken: OAuthTokenWithAuthorization | undefined;
    auditScope: AuditScope;
    input: {
      installationId: string;
      name: string;
      os: string;
      arch: string;
      appVersion: string;
      reportedClients: {
        key: string;
        name: string;
        detected: boolean;
        installable: boolean;
        supportsSkills: boolean;
      }[];
      magicMcpTokenIds?: string[];
    };
  }) {
    let oauthToken = this.assertDeviceSignIn(d.oauthToken);

    let details = {
      name: d.input.name,
      os: d.input.os,
      arch: d.input.arch,
      appVersion: d.input.appVersion,
      lastSeenAt: new Date()
    };

    let enroll = async () =>
      await withTransaction(async db => {
        let existing = await db.consumerDevice.findUnique({
          where: {
            consumerProfileOid_installationId: {
              consumerProfileOid: d.consumerProfile.oid,
              installationId: d.input.installationId
            }
          },
          include: consumerDeviceInclude
        });

        if (existing?.oauthTokenOid == oauthToken.oid) {
          if (existing.status != 'active') throw this.endedSignInError();

          await this.syncReportedClients({ ...d, consumerDevice: existing });
          await this.linkInstallTokens({ ...d, consumerDevice: existing });

          return await db.consumerDevice.update({
            where: { oid: existing.oid },
            data: details,
            include: consumerDeviceInclude
          });
        }

        // A new sign-in on this installation replaces the old one.
        if (existing?.oauthTokenOid) {
          await oauthAuthorizationService.revokeOAuthToken({
            oauthToken: { oid: existing.oauthTokenOid }
          });
        }

        // A sign-in whose installation lost its data dir moves over to the new
        // installation; the device it leaves keeps no sign-in.
        let displaced = await db.consumerDevice.findUnique({
          where: { oauthTokenOid: oauthToken.oid },
          include: consumerDeviceInclude
        });
        if (displaced && displaced.status != 'active') throw this.endedSignInError();
        if (displaced) {
          await this.endDeviceSignIn({
            consumerDevice: displaced,
            auditScope: d.auditScope,
            status: 'signed_out',
            signInMoved: true
          });
        }

        let enrolled = await db.consumerDevice.upsert({
          where: {
            consumerProfileOid_installationId: {
              consumerProfileOid: d.consumerProfile.oid,
              installationId: d.input.installationId
            }
          },
          create: {
            ...details,
            id: await ID.generateId('consumerDevice'),
            installationId: d.input.installationId,
            consumerProfileOid: d.consumerProfile.oid,
            instanceOid: d.instance.oid,
            oauthTokenOid: oauthToken.oid
          },
          update: {
            ...details,
            status: 'active',
            revokedAt: null,
            oauthTokenOid: oauthToken.oid
          }
        });

        await this.syncReportedClients({ ...d, consumerDevice: enrolled });
        await this.linkInstallTokens({ ...d, consumerDevice: enrolled });

        let consumerDevice = await db.consumerDevice.findUniqueOrThrow({
          where: { oid: enrolled.oid },
          include: consumerDeviceInclude
        });

        addAfterTransactionHook(() =>
          existing
            ? Fabric.fire('consumer.device.updated:after', {
                consumerDevice,
                previousConsumerDevice: existing,
                auditScope: d.auditScope
              })
            : Fabric.fire('consumer.device.enrolled:after', {
                consumerDevice,
                auditScope: d.auditScope
              })
        );

        return consumerDevice;
      });

    try {
      return await enroll();
    } catch (error) {
      // Two first check-ins of one installation race to create it; the one
      // that loses finds the device on its retry.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code == 'P2002') {
        return await enroll();
      }
      throw error;
    }
  }

  async listDevices(d: {
    instance: Instance;
    consumerProfileIds?: string[];
    consumerIds?: string[];
    statuses?: ConsumerDeviceStatus[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.consumerDevice.findMany({
            ...opts,
            where: {
              instanceOid: d.instance.oid,
              status: d.statuses ? { in: d.statuses } : 'active',
              ...(d.consumerProfileIds || d.consumerIds
                ? {
                    consumerProfile: {
                      id: d.consumerProfileIds ? { in: d.consumerProfileIds } : undefined,
                      consumer: d.consumerIds ? { id: { in: d.consumerIds } } : undefined
                    }
                  }
                : {})
            },
            include: consumerDeviceInclude
          })
      )
    );
  }

  async getDeviceById(d: {
    instance: Instance;
    consumerDeviceId: string;
    consumerProfile?: Pick<ConsumerProfile, 'oid'>;
  }) {
    let consumerDevice = await db.consumerDevice.findFirst({
      where: {
        id: d.consumerDeviceId,
        instanceOid: d.instance.oid,
        consumerProfileOid: d.consumerProfile?.oid
      },
      include: consumerDeviceInclude
    });
    if (!consumerDevice) {
      throw new ServiceError(notFoundError('consumer.device', d.consumerDeviceId));
    }

    return consumerDevice;
  }

  async updateClientSetting(d: {
    consumerDevice: ConsumerDeviceRecord;
    clientKey: string;
    auditScope: AuditScope;
    input: {
      enabled?: boolean;
      excludedMagicMcpServerIds?: string[];
      excludedSkillIds?: string[];
    };
  }) {
    this.assertDeviceActive(d.consumerDevice);
    let client = d.consumerDevice.clients.find(
      entry => entry.mcpClientType.key == d.clientKey
    );
    if (!client) {
      throw new ServiceError(notFoundError('consumer.device.client', d.clientKey));
    }

    let { excludedMagicMcpServerIds, excludedSkillIds } = d.input;

    return await withTransaction(async db => {
      // Always written, so concurrent changes to this tool wait for each other
      // instead of interleaving their exclusion rewrites.
      await db.consumerDeviceClient.update({
        where: { oid: client.oid },
        data: { enabled: d.input.enabled, updatedAt: new Date() }
      });

      // Ids that aren't servers or skills of this instance can't match
      // anything the device installs, so they are dropped.
      if (excludedMagicMcpServerIds) {
        let servers = await db.magicMcpServer.findMany({
          where: {
            id: { in: excludedMagicMcpServerIds },
            instanceOid: d.consumerDevice.instanceOid
          }
        });

        await db.consumerDeviceClientExcludedMagicMcpServer.deleteMany({
          where: { consumerDeviceClientOid: client.oid }
        });
        await db.consumerDeviceClientExcludedMagicMcpServer.createMany({
          data: await Promise.all(
            servers.map(async server => ({
              id: await ID.generateId('consumerDeviceClientExcludedMagicMcpServer'),
              consumerDeviceClientOid: client.oid,
              magicMcpServerOid: server.oid
            }))
          )
        });
      }

      if (excludedSkillIds) {
        let skills = await db.skill.findMany({
          where: { id: { in: excludedSkillIds }, instanceOid: d.consumerDevice.instanceOid }
        });

        await db.consumerDeviceClientExcludedSkill.deleteMany({
          where: { consumerDeviceClientOid: client.oid }
        });
        await db.consumerDeviceClientExcludedSkill.createMany({
          data: await Promise.all(
            skills.map(async skill => ({
              id: await ID.generateId('consumerDeviceClientExcludedSkill'),
              consumerDeviceClientOid: client.oid,
              skillOid: skill.oid
            }))
          )
        });
      }

      let consumerDevice = await db.consumerDevice.update({
        where: { oid: d.consumerDevice.oid },
        data: { updatedAt: new Date() },
        include: consumerDeviceInclude
      });

      addAfterTransactionHook(() =>
        Fabric.fire('consumer.device.updated:after', {
          consumerDevice,
          previousConsumerDevice: d.consumerDevice,
          auditScope: d.auditScope
        })
      );

      return consumerDevice;
    });
  }

  async revokeDevice(d: { consumerDevice: ConsumerDeviceRecord; auditScope: AuditScope }) {
    return await this.endDeviceSignIn({ ...d, status: 'revoked' });
  }

  async signOutDevice(d: {
    consumerProfile: Pick<ConsumerProfile, 'oid'>;
    oauthToken: Pick<OAuthTokenWithAuthorization, 'oid'> | undefined;
    auditScope: AuditScope;
  }) {
    let consumerDevice = d.oauthToken
      ? await db.consumerDevice.findFirst({
          where: {
            oauthTokenOid: d.oauthToken.oid,
            consumerProfileOid: d.consumerProfile.oid,
            status: 'active'
          },
          include: consumerDeviceInclude
        })
      : null;
    if (!consumerDevice) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'This sign-in does not belong to an enrolled device.'
        })
      );
    }

    return await this.endDeviceSignIn({
      consumerDevice,
      auditScope: d.auditScope,
      status: 'signed_out'
    });
  }

  async revokeDevicesForAuthorization(d: {
    oauthAuthorization: Pick<OAuthAuthorization, 'oid'>;
    auditScope: AuditScope;
  }) {
    let consumerDevices = await withTransaction(
      async db =>
        await db.consumerDevice.findMany({
          where: {
            status: 'active',
            oauthToken: { oauthAuthorizationOid: d.oauthAuthorization.oid }
          },
          include: consumerDeviceInclude
        }),
      { ifExists: true }
    );

    for (let consumerDevice of consumerDevices) {
      await this.endDeviceSignIn({
        consumerDevice,
        auditScope: d.auditScope,
        status: 'revoked'
      });
    }
  }

  private async endDeviceSignIn(d: {
    consumerDevice: ConsumerDeviceRecord;
    auditScope: AuditScope;
    status: 'signed_out' | 'revoked';
    signInMoved?: boolean;
  }) {
    return await withTransaction(async db => {
      let ended = await db.consumerDevice.updateMany({
        where: { oid: d.consumerDevice.oid, status: 'active' },
        data: {
          status: d.status,
          revokedAt: d.status == 'revoked' ? new Date() : null,
          ...(d.signInMoved ? { oauthTokenOid: null } : {})
        }
      });
      if (!ended.count) {
        throw new ServiceError(
          preconditionFailedError({ message: 'This device is no longer signed in.' })
        );
      }

      if (d.consumerDevice.oauthTokenOid && !d.signInMoved) {
        await oauthAuthorizationService.revokeOAuthToken({
          oauthToken: { oid: d.consumerDevice.oauthTokenOid }
        });
      }

      let consumerDevice = await db.consumerDevice.findUniqueOrThrow({
        where: { oid: d.consumerDevice.oid },
        include: consumerDeviceInclude
      });

      // Fired inside the transaction: the magic module deletes this device's
      // install tokens in a listener, and a failure there must undo the change.
      await Fabric.fire('consumer.device.ended:after', {
        consumerDevice,
        previousConsumerDevice: d.consumerDevice,
        auditScope: d.auditScope
      });

      return consumerDevice;
    });
  }

  private assertDeviceSignIn(oauthToken: OAuthTokenWithAuthorization | undefined) {
    if (
      !oauthToken ||
      oauthToken.oauthAuthorization.subjectType != 'consumer' ||
      oauthToken.oauthAuthorization.oauthApplication.type != 'cli_auth'
    ) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Devices can only be enrolled from a Metorial Desktop or CLI sign-in.'
        })
      );
    }

    return oauthToken;
  }

  // Tools the app stops reporting keep their row, so their settings come back
  // if the tool is installed again.
  private async syncReportedClients(d: {
    consumerDevice: Pick<ConsumerDevice, 'oid'>;
    input: {
      reportedClients: {
        key: string;
        name: string;
        detected: boolean;
        installable: boolean;
        supportsSkills: boolean;
      }[];
    };
  }) {
    let reported = new Map(
      d.input.reportedClients
        .filter(client => knownClientKeys.has(client.key))
        .map(client => [client.key, client])
    );
    let keys = [...reported.keys()];

    await withTransaction(async db => {
      await db.mcpClientType.createMany({
        data: await Promise.all(
          keys.map(async key => ({ id: await ID.generateId('mcpClientType'), key }))
        ),
        skipDuplicates: true
      });

      let clientTypes = await db.mcpClientType.findMany({ where: { key: { in: keys } } });
      let existing = await db.consumerDeviceClient.findMany({
        where: { consumerDeviceOid: d.consumerDevice.oid }
      });
      let existingByType = new Map(existing.map(client => [client.mcpClientTypeOid, client]));

      for (let clientType of clientTypes) {
        let client = reported.get(clientType.key)!;
        let details = {
          name: client.name,
          detected: client.detected,
          installable: client.installable,
          supportsSkills: client.supportsSkills,
          reported: true
        };
        let current = existingByType.get(clientType.oid);
        let unchanged =
          current &&
          (Object.keys(details) as (keyof typeof details)[]).every(
            field => current[field] == details[field]
          );
        if (unchanged) continue;

        await db.consumerDeviceClient.upsert({
          where: {
            consumerDeviceOid_mcpClientTypeOid: {
              consumerDeviceOid: d.consumerDevice.oid,
              mcpClientTypeOid: clientType.oid
            }
          },
          create: {
            ...details,
            id: await ID.generateId('consumerDeviceClient'),
            consumerDeviceOid: d.consumerDevice.oid,
            mcpClientTypeOid: clientType.oid
          },
          update: details
        });
      }

      await db.consumerDeviceClient.updateMany({
        where: {
          consumerDeviceOid: d.consumerDevice.oid,
          reported: true,
          mcpClientTypeOid: { notIn: clientTypes.map(clientType => clientType.oid) }
        },
        data: { reported: false }
      });
    });
  }

  // Install tokens created before the device enrolled (or by an older app)
  // carry no device; the app reports them so a revoke deletes them too. Only
  // the profile's own unlinked tokens are taken.
  private async linkInstallTokens(d: {
    instance: Instance;
    consumerProfile: ConsumerProfile;
    consumerDevice: Pick<ConsumerDevice, 'oid'>;
    input: { magicMcpTokenIds?: string[] };
  }) {
    if (!d.input.magicMcpTokenIds?.length) return;

    await withTransaction(
      async db =>
        await db.magicMcpToken.updateMany({
          where: {
            id: { in: d.input.magicMcpTokenIds },
            status: 'active',
            instanceOid: d.instance.oid,
            consumerDeviceOid: null,
            consumerTokens: { some: { consumerProfileOid: d.consumerProfile.oid } }
          },
          data: { consumerDeviceOid: d.consumerDevice.oid }
        }),
      { ifExists: true }
    );
  }

  private endedSignInError() {
    return new ServiceError(
      preconditionFailedError({
        message: 'This sign-in was ended. Sign in again to enroll this device.'
      })
    );
  }

  private assertDeviceActive(consumerDevice: ConsumerDevice) {
    if (consumerDevice.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'This device is no longer signed in.'
        })
      );
    }
  }
}

export let consumerDeviceService = Service.create(
  'consumerDeviceService',
  () => new ConsumerDeviceServiceImpl()
).build();
