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

export let consumerDeviceStatuses = Object.values(ConsumerDeviceStatus);

export let consumerDeviceInclude = {
  clientSettings: { orderBy: { clientKey: 'asc' } },
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
      reportedClients: PrismaJson.ConsumerDeviceReportedClients;
      magicMcpTokenIds?: string[];
    };
  }) {
    let oauthToken = this.assertDeviceSignIn(d.oauthToken);

    let details = {
      name: d.input.name,
      os: d.input.os,
      arch: d.input.arch,
      appVersion: d.input.appVersion,
      reportedClients: d.input.reportedClients,
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

        let consumerDevice = await db.consumerDevice.upsert({
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
          },
          include: consumerDeviceInclude
        });

        await this.linkInstallTokens({ ...d, consumerDevice });

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
    if (!d.consumerDevice.reportedClients.some(client => client.key == d.clientKey)) {
      throw new ServiceError(notFoundError('consumer.device.client', d.clientKey));
    }

    let data = {
      enabled: d.input.enabled,
      excludedMagicMcpServerIds: d.input.excludedMagicMcpServerIds
        ? Array.from(new Set(d.input.excludedMagicMcpServerIds))
        : undefined,
      excludedSkillIds: d.input.excludedSkillIds
        ? Array.from(new Set(d.input.excludedSkillIds))
        : undefined
    };

    return await withTransaction(async db => {
      await db.consumerDeviceClientSetting.upsert({
        where: {
          consumerDeviceOid_clientKey: {
            consumerDeviceOid: d.consumerDevice.oid,
            clientKey: d.clientKey
          }
        },
        create: {
          ...data,
          id: await ID.generateId('consumerDeviceClientSetting'),
          consumerDeviceOid: d.consumerDevice.oid,
          clientKey: d.clientKey
        },
        update: data
      });

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
