import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  CliDevice,
  db,
  ID,
  OAuthAuthorization,
  Organization,
  User,
  withTransaction
} from '@metorial/db';

let cliDeviceInclude = {
  organization: true,
  user: true,
  oauthAuthorization: true
} as const;

class CliDeviceService {
  async upsertCliDevice(d: {
    ip: string;
    organization: Organization;
    user: User;
    oauthAuthorization: OAuthAuthorization;
  }) {
    return withTransaction(async db => {
      return await db.cliDevice.upsert({
        where: {
          ip_userOid_organizationOid: {
            ip: d.ip,
            userOid: d.user.oid,
            organizationOid: d.organization.oid
          }
        },
        create: {
          id: await ID.generateId('cliDevice'),
          ip: d.ip,
          organizationOid: d.organization.oid,
          userOid: d.user.oid,
          oauthAuthorizationOid: d.oauthAuthorization.oid
        },
        update: {
          oauthAuthorizationOid: d.oauthAuthorization.oid
        },
        include: cliDeviceInclude
      });
    });
  }

  async getCliDeviceById(d: { organization: Organization; cliDeviceId: string }) {
    let cliDevice = await db.cliDevice.findFirst({
      where: {
        id: d.cliDeviceId,
        organizationOid: d.organization.oid
      },
      include: cliDeviceInclude
    });

    if (!cliDevice) {
      throw new ServiceError(notFoundError('cli_device', d.cliDeviceId));
    }

    return cliDevice;
  }

  async listCliDevices(d: { organization: Organization }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.cliDevice.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid
            },
            orderBy: {
              updatedAt: 'desc'
            },
            include: cliDeviceInclude
          })
      )
    );
  }
}

export let cliDeviceService = Service.create(
  'cliDeviceService',
  () => new CliDeviceService()
).build();

export type CliDeviceWithRelations = CliDevice & {
  organization: Organization;
  user: User;
  oauthAuthorization: OAuthAuthorization;
};
