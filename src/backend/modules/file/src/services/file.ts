import { db, File, ID, Instance, Organization } from '@metorial/db';
import { badRequestError, forbiddenError, notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { purposes } from '../definitions';

export type FileOwner =
  | {
      type: 'user';
      user: { id: string };
    }
  | {
      type: 'organization';
      organization: Organization;
    }
  | {
      type: 'instance';
      organization: Organization;
      instance: Instance;
    };

class FileServiceImpl {
  private async ensureFileActive(file: File) {
    if (file.status !== 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on a deleted file'
        })
      );
    }
  }

  private async getUserOid(userId: string) {
    let user = await db.user.findFirst({
      where: { id: userId }
    });
    if (!user) throw new Error('WTF - user not found');
    return user.oid;
  }

  async createFile(d: {
    owner: FileOwner;
    storeId: string;
    purpose: string;
    input: {
      name: string;
      mimeType: string;
      size: number;

      title?: string;
    };
  }) {
    let purpose = await purposes[d.purpose as keyof typeof purposes];
    if (!purpose) {
      throw new ServiceError(
        badRequestError({
          message: `Invalid file purpose: ${d.purpose}`
        })
      );
    }

    if (purpose.ownerType !== d.owner.type) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid file purpose for owner'
        })
      );
    }

    return await db.file.create({
      data: {
        id: await ID.generateId('file'),
        storeId: d.storeId,
        purposeOid: purpose.oid,
        organizationOid: d.owner.type === 'organization' ? d.owner.organization.oid : null,
        userOid: d.owner.type === 'user' ? await this.getUserOid(d.owner.user.id) : null,

        fileName: d.input.name,
        fileSize: d.input.size,
        fileType: d.input.mimeType,

        title: d.input.title
      },
      include: {
        purpose: true
      }
    });
  }

  async getFileById(d: { fileId: string; owner: FileOwner }) {
    let userOid = d.owner.type === 'user' ? await this.getUserOid(d.owner.user.id) : null;

    let file = await db.file.findUnique({
      where: {
        id: d.fileId,

        // organizationOid: d.owner.type === 'organization' ? d.owner.organization.oid : null,
        // userOid: d.owner.type === 'user' ? d.owner.user.oid : null

        ...(d.owner.type === 'organization' || d.owner.type === 'instance'
          ? {
              organizationOid: d.owner.organization.oid
            }
          : {
              OR: [
                {
                  userOid: userOid!
                },
                {
                  organization: {
                    members: {
                      some: {
                        userOid: userOid!
                      }
                    }
                  }
                }
              ]
            })
      },
      include: {
        purpose: true
      }
    });
    if (!file) {
      throw new ServiceError(notFoundError('file', d.fileId));
    }

    return file;
  }

  async updateFile(d: {
    file: File;
    input: {
      title?: string;
    };
  }) {
    await this.ensureFileActive(d.file);

    let file = await db.file.update({
      where: {
        id: d.file.id
      },
      data: {
        title: d.input.title
      },
      include: {
        purpose: true
      }
    });

    return file;
  }

  async deleteFile(d: { file: File }) {
    throw new ServiceError(
      badRequestError({
        message: 'You cannot delete this file'
      })
    );

    await this.ensureFileActive(d.file);

    return await db.file.update({
      where: {
        id: d.file.id
      },
      data: {
        status: 'deleted'
      },
      include: {
        purpose: true
      }
    });
  }

  async listFiles(d: { owner: FileOwner; purpose?: string }) {
    let purpose = d.purpose ? await purposes[d.purpose as keyof typeof purposes] : undefined;
    if (purpose && purpose.ownerType !== d.owner.type) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid file purpose for owner'
        })
      );
    }

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.file.findMany({
            ...opts,
            where: {
              organizationOid:
                d.owner.type === 'organization' ? d.owner.organization.oid : null,
              userOid: d.owner.type === 'user' ? await this.getUserOid(d.owner.user.id) : null,
              status: 'active',

              purposeOid: purpose?.oid
            },
            include: {
              purpose: true
            }
          })
      )
    );
  }
}

export let fileService = Service.create('file', () => new FileServiceImpl()).build();
